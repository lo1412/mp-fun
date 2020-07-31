const FATAL_REBUILD_TOLERANCE = 10
const SETDATA_SCROLL_TO_BOTTOM = {
  scrollTop: 100000,
  scrollWithAnimation: true,
}

const COLLECTIONS = {
  chat: 'chat',
  room: 'room',
  connection: 'connection'
}

const watchers = {}

const getRandomId = () => `${Math.random()}_${Date.now()}`

Component({
  properties: {
    envId: String,
    userInfo: Object,
    onGetUserInfo: {
      type: Function,
    },
    getOpenID: {
      type: Function,
    },
  },

  data: {
    connection: {},
    chats: [],
    textInputValue: '',
    openId: '',
    scrollTop: 0,
    scrollToMessage: '',
    hasKeyboard: false,
    count: 0
  },

  methods: {
    onGetUserInfo(e) {
      this.properties.onGetUserInfo(e)
    },

    getOpenID() { 
      return this.properties.getOpenID() 
    },

    async initConnection() {
      this.try(async () => {
        await this.initOpenID()

        const { envId } = this.properties
        const db = this.db = wx.cloud.database({
          env: envId,
        })
        const _ = db.command

        const { data: [my_connection] } = await db.collection(COLLECTIONS.connection).where({_openid: this.data.openId}).get()

        let connection = {}
        if (my_connection) {
          connection.status = 1
          connection.openid_other = null
          connection.status_change_time = null
          connection.roomid = null
          db.collection(COLLECTIONS.connection).doc(my_connection._id).update({
            data: connection
          })
          connection = Object.assign(my_connection, connection)
        } else {
          connection = {
            _id: getRandomId(),
            status: 1,
            openid_other: null,
            status_change_time: null,
            roomid: null
          }
          db.collection(COLLECTIONS.connection).add({
            data: connection
          })
          connection._openid = this.data.openId
        }

        this.setData({ connection })

        this.addWatcher(
          COLLECTIONS.connection,
          { _openid: this.data.openId },
          this.onConnectionChange.bind(this)
        )
      }, '初始化失败')
    },

    onConnectionChange(snapshot) {
      if (snapshot.type === 'init') {
        this.inited = true
      } else {
        for (const docChange of snapshot.docChanges) {
          if (docChange.queueType === 'update') {
            const { connection } = this.data
            if (connection.status !== docChange.doc.status) {
              if (connection.status !== 3 && docChange.doc.status === 3) {
                // 进入房间
                this.joinRoom(docChange.doc.status.roomid)
              } else if (connection.status === 3 && docChange.doc.status === 1) {
                // 对方离开房间
                if (watchers[COLLECTIONS.chat]) {
                  watchers[COLLECTIONS.chat].close()
                }
              }
              this.setData({
                connection: docChange.doc
              })
            }
            break
          }
        }
      }
    },

    onChatChange(snapshot) {
      console.error(snapshot)
      if (snapshot.type === 'init') {
        this.scrollToBottom()
      } else {
        let hasNewMessage = false
        let hasOthersMessage = false
        const chats = [...this.data.chats]
        for (const docChange of snapshot.docChanges) {
          // switch (docChange.queueType) {
          //   case 'enqueue': {
              hasOthersMessage = docChange.doc._openid !== this.data.openId
              const index = chats.findIndex(chat => chat._id === docChange.doc._id)
              if (index > -1) {
                if (chats[index].type === 'image' && chats[index].tempFilePath) {
                  chats.splice(index, 1, {
                    ...docChange.doc,
                    tempFilePath: chats[index].tempFilePath,
                  })
                } else chats.splice(index, 1, docChange.doc)
              } else {
                hasNewMessage = true
                chats.push(docChange.doc)
              }
              break
            }
        //   }
        // }
        this.setData({
          chats: chats.sort((x, y) => y.send_time - x.send_time),
        })
        if (hasOthersMessage || hasNewMessage) {
          this.scrollToBottom()
        }
      }
    },

    joinRoom(roomid) {
      this.addWatcher(
        COLLECTIONS.chat,
        { roomid },
        this.onChatChange.bind(this)
      )
    },

    async prepareJoinRoom() {
      this.try(async () => {
        const db = this.db
        const _ = db.command

        let { data: list } = await db.collection(COLLECTIONS.connection).where({
          _openid: _.not(_.eq(this.data.openId)),
          status: 2
        }).get()
        const { connection, openId } = this.data

        if (list.length) {
          list.sort((x, y) => x.status_change_time - y.status_change_time)
          connection.status = 3
          connection.openid_other = list[0]._openid
          connection.status_change_time = null
          connection.roomid =  getRandomId()
          db.collection(COLLECTIONS.room).add({
            data: {
              _id: connection.roomid,
              openid_1: openId,
              openid_2: list[0]._openid
            }
          })
          db.collection(COLLECTIONS.connection).doc(connection._id).update({
            data: {
              status: connection.status,
              openid_other: connection.openid_other,
              status_change_time: connection.status_change_time,
              roomid: connection.roomid
            }
          })
          db.collection(COLLECTIONS.connection).doc(list[0]._id).update({
            data: {
              status: connection.status,
              openid_other: openId,
              status_change_time: null,
              roomid: connection.roomid
            }
          })
          this.joinRoom(connection.roomid)
        } else {
          connection.status = 2
          connection.status_change_time = Date.now()
          db.collection(COLLECTIONS.connection).doc(connection._id).update({
            data: {
              status: connection.status,
              status_change_time: connection.status_change_time
            }
          })
        }

        this.setData({
          connection
        })
      }, '初始化失败')
    },

    async addWatcher(collection, criteria, onChange) {
      this.try(() => {
        const db = this.db
        const _ = db.command

        console.warn(`开始监听`, collection, criteria)
        if (watchers[collection]) {
          watchers[collection].close()
        }
        watchers[collection] = db.collection(collection).where(criteria).watch({
          onChange,
          onError: e => {
            // if (!this.inited || this.fatalRebuildCount >= FATAL_REBUILD_TOLERANCE) {
            //   this.showError(this.inited ? '监听错误，已断开' : '初始化监听失败', e, '重连', () => {
            //     this.initWatch(this.data.chats.length ? {
            //       sendTimeTS: _.gt(this.data.chats[this.data.chats.length - 1].sendTimeTS),
            //     } : {})
            //   })
            // } else {
            //   this.initWatch(this.data.chats.length ? {
            //     sendTimeTS: _.gt(this.data.chats[this.data.chats.length - 1].sendTimeTS),
            //   } : {})
            // }
          },
        })
      }, '初始化监听失败')
    },

    async initOpenID() {
      return this.try(async () => {
        const openId = await this.getOpenID()

        this.setData({
          openId,
        })
      }, '初始化 openId 失败')
    },

    bot() {
      setTimeout(() => {
        const count = this.data.count + 1
        this.setData({
          count,
          chats: [
            ...this.data.chats,
            {
              _id: getRandomId(),
              user_info: {
                nickName: 'bot'
              },
              content: count === 1 ? '等待连接' : count,
              send_time: Date.now()
            },
          ],
        })

        if (count > 0) {
          this.prepareJoinRoom()
        }

        this.scrollToBottom(true)
      }, 1000)
    },

    async onConfirmSendText(e) {
      this.try(async () => {
        if (!e.detail.value) {
          return
        }

        const db = this.db
        const _ = db.command

        const chat = {
          _id: getRandomId(),
          roomid: this.data.connection.roomid,
          user_info: this.data.userInfo,
          type: 'text',
          content: e.detail.value,
          send_time: Date.now()
        }

        this.setData({
          textInputValue: '',
          chats: [
            ...this.data.chats,
            {
              ...chat,
              _openid: this.data.openId,
              writeStatus: this.data.connection.status === 3 ? 'pending' : 'written',
            },
          ],
        })
        this.scrollToBottom(true)

        if (this.data.connection.status !== 3) return this.bot()

        await db.collection(COLLECTIONS.chat).add({
          data: chat,
        })

        this.setData({
          chats: this.data.chats.map(v => {
            if (v._id === chat._id) {
              return {
                ...v,
                writeStatus: 'written',
              }
            } else return v
          }),
        })
      }, '发送文字失败')
    },

    async onChooseImage(e) {
      wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        success: async res => {
          const { envId } = this.properties
          const chat = {
            _id: getRandomId(),
            roomid: this.data.connection.roomid,
            user_info: this.data.userInfo,
            type: 'image',
            send_time: Date.now()
          }

          this.setData({
            chats: [
              ...this.data.chats,
              {
                ...chat,
                _openid: this.data.openId,
                tempFilePath: res.tempFilePaths[0],
                writeStatus: 0,
              },
            ]
          })
          this.scrollToBottom(true)

          const uploadTask = wx.cloud.uploadFile({
            cloudPath: `${this.data.openId}/${Math.random()}_${Date.now()}.${res.tempFilePaths[0].match(/\.(\w+)$/)[1]}`,
            filePath: res.tempFilePaths[0],
            config: {
              env: envId,
            },
            success: res => {
              this.try(async () => {
                await this.db.collection(COLLECTIONS.chat).add({
                  data: {
                    ...chat,
                    image_id: res.fileID,
                  },
                })
              }, '发送图片失败')
            },
            fail: e => {
              this.showError('发送图片失败', e)
            },
          })

          uploadTask.onProgressUpdate(({ progress }) => {
            this.setData({
              chats: this.data.chats.map(v => {
                if (v._id === chat._id) {
                  return {
                    ...v,
                    writeStatus: progress,
                  }
                } else return v
              })
            })
          })
        },
      })
    },

    onMessageImageTap(e) {
      wx.previewImage({
        urls: [e.target.dataset.fileid],
      })
    },

    scrollToBottom(force) {
      if (force) {
        console.log('force scroll to bottom')
        this.setData(SETDATA_SCROLL_TO_BOTTOM)
        return
      }

      this.createSelectorQuery().select('.body').boundingClientRect(bodyRect => {
        this.createSelectorQuery().select(`.body`).scrollOffset(scroll => {
          if (scroll.scrollTop + bodyRect.height * 3 > scroll.scrollHeight) {
            console.log('should scroll to bottom')
            this.setData(SETDATA_SCROLL_TO_BOTTOM)
          }
        }).exec()
      }).exec()
    },

    async onScrollToUpper() {
      // if (this.db && this.data.chats.length) {
      //   const { collection } = this.properties
      //   const _ = this.db.command
      //   const { data } = await this.db.collection(collection).where(this.mergeCommonCriteria({
      //     sendTimeTS: _.lt(this.data.chats[0].sendTimeTS),
      //   })).orderBy('sendTimeTS', 'desc').get()
      //   this.data.chats.unshift(...data.reverse())
      //   this.setData({
      //     chats: this.data.chats,
      //     scrollToMessage: `item-${data.length}`,
      //     scrollWithAnimation: false,
      //   })
      // }
    },

    async try(fn, title) {
      try {
        await fn()
      } catch (e) {
        this.showError(title, e)
      }
    },

    showError(title, content, confirmText, confirmCallback) {
      console.error(title, content)
      wx.showModal({
        title,
        content: content.toString(),
        showCancel: confirmText ? true : false,
        confirmText,
        success: res => {
          res.confirm && confirmCallback()
        },
      })
    },
  },

  ready() {
    this.initConnection()
  },
})
