const FATAL_REBUILD_TOLERANCE = 10
const SETDATA_SCROLL_TO_BOTTOM = {
  scrollTop: 100000,
  scrollWithAnimation: true,
}

const COLLECTIONS = {
  mood: 'mood',
  comfort: 'comfort',
}

// mood: _id, _openid, mood, key, user_info, send_time
// comfort: 同上

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
    chats: [],
    textInputValue: '',
    openId: '',
    scrollTop: 0,
    scrollToMessage: '',
    count: 0
  },

  ready() {
    this.init()
  },

  methods: {
    async init() {
      this.needComfort = true
      this.try(async () => {
        await this.initOpenID()
        this.db = wx.cloud.database({
          env: this.properties.envId,
        })
      }, '初始化失败')
    },

    onGetUserInfo(e) {
      this.properties.onGetUserInfo(e)
    },

    async initOpenID() {
      return this.try(async () => {
        const openId = await this.properties.getOpenID()()

        this.setData({
          openId,
        })
      }, '初始化 openId 失败')
    },

    initChat() {
      if (this.chatInited) return
      this.chatInited = true
      wx.onAccelerometerChange(({x, y, z}) => {
          if (!this.chatting || this.ignoreAcc || x < 1 || y < 1) return
          this.ignoreAcc = true
          this.pullChat()
          setTimeout(() => {
            this.ignoreAcc = false
          }, 1000)
      })
    },

    async pullChat() {
      // 拉一条
      if (this.needComfort) {
        // 拉取安抚自己最近mood的comfort
      } else {
        // 随便拉mood
        const db = this.db
        const _ = db.command
        const { data } = await db.collection(COLLECTIONS.mood)
          .aggregate()
          .sample({
            size: 1
          })
          .end()
        // todo 拿到后处理成chat
      }
    },

    async pushChat(e) {
      this.try(async () => {
        if (!e.detail.value) return

        const db = this.db
        const _ = db.command

        const chat = {
          _id: getRandomId(),
          user_info: this.data.userInfo,
          type: 'text',
          content: e.detail.value,
          send_time: Date.now(),
          targetId: '',
          targetText: ''
        }

        this.setData({
          textInputValue: '',
          chats: [
            ...this.data.chats,
            {
              ...chat,
              _openid: this.data.openId,
              writeStatus: 'pending',
            },
          ],
        })

        this.scrollToBottom(true)

        this.count += 1

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

})
