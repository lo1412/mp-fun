// miniprogram/pages/paper-plane/paper-plane.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    status: 'welcome',
    mood: '生活是一段旅程并非每个人都会去同一个地方。',
    content: '',
    name: 'hakon',
    avatarUrl: '',
    userInfo: null,
    openId: '',
    onGetUserInfo: null,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // wx.getSetting({
    //   success: res => {
    //     console.log(res)
    //     if (res.authSetting['scope.userInfo']) {
    //       // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
    //       wx.getUserInfo({
    //         success: res => {
    //           this.setData({
    //             avatarUrl: res.userInfo.avatarUrl,
    //             userInfo: res.userInfo
    //           })
    //         }
    //       })
    //     }
    //   }
    // })

    this.init()
  },

  init: async function() {
    this.try(async () => {
      await this.initOpenID()
      this.db = wx.cloud.database({
        env: this.properties.envId,
      })
      this.setData({
        onGetUserInfo: this.onGetUserInfo,
        setStatus: this.setStatus
      })

      this.isInit = true
    }, '初始化失败')
  },

  initOpenID: async function() {
    const { result } = await wx.cloud.callFunction({
      name: 'login',
    })

    this.setData({
      openId: result.openid
    })
  },

  onGetUserInfo: function(e) {
    if (e.detail.userInfo) {
      this.setData({
        avatarUrl: e.detail.userInfo.avatarUrl,
        userInfo: e.detail.userInfo
      })
    }
  },

  onConfirm(e) {
    this.setData({
      content: e.detail.value.trim()
    })
  },

  goToPrepare() {
    this.setStatus('prepare')
  },

  send() {
    // console.log(this.data.content)

    this.setData({
      content: ''
    })
  },

  setStatus(status) {
    if (!this.isInit || !this.data.openId || !this.data.userInfo) return
    this.setData({status})
    status === 'sending' && this.send()
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '纸飞机',
      path: '/pages/paper-plane/paper-plane',
    }
  },


  ///////////////// 下方为原逻辑

  getKey(value = this.data.lastMood.content) {

  },

  bot() {

  },

  addChat(chat) {
    this.setData({ chats: [...this.data.chats, chat] })
    this.scrollToBottom(true)
  },

  async pullChat() {
    // 拉一条
    if (this.needComfort) {
      // 拉取安抚自己最近mood的comfort
      if (!this.data.lastMood) return

      const db = this.db
      const _ = db.command

      // 直接命中
      let res = await this.aggregate(
        COLLECTIONS.comfort,
        { content: _.eq(this.data.lastMood.content) }
      )
      if (res.data.length) {
        this.addChat(res.data[0])
        return
      }

      // 没有直接命中，根据key找
      const key = await this.getKey()
      if (key) {
        res = await this.aggregate(
          COLLECTIONS.comfort,
          { key: _.eq(key) }
        )
        if (res.data.length) {
          this.addChat(res.data[0])
          return
        }
      }
      
      // 全部未命中
      this.bot()
    } else {
      // 随便拉mood
      const db = this.db
      const _ = db.command
      const { data } = await this.aggregate(COLLECTIONS.mood)
      if (!data.length) return
      this.addChat(data[0])
    }
  },

  async pushChat(e) {
    this.try(async () => {
      const content = e.detail.value.trim().slice(0, 140)
      if (!content) return

      const db = this.db
      const _ = db.command

      const key = await (this.needComfort ? this.getKey() : this.data.chats.slice(-1)[0].key)

      if (!key) {
        this.bot()
        return
      }

      const chat = {
        _id: getRandomId(),
        _openid: this.data.openId,
        user_info: this.data.userInfo,
        content,
        send_time: Date.now(),
        type: this.needComfort ? 'mood' : 'comfort',
        key
      }

      if (this.needComfort) {
        this.setData({ lastMood: chat })
      }

      this.setData({ textInputValue: '' })
      this.addChat(chat)

      this.count += 1

      await db.collection(COLLECTIONS.chat).add({
        data: chat,
      })

      if (this.needComfort) {
        this.pullChat()
      }
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

  aggregate(collection, where = {}, size = 1) {
    const db = this.db
    const _ = db.command
    return db
      .collection(collection)
      .where({
        _openid: _.not(_.eq(this.data.openId)),
        ...where
      }).
      aggregate()
      .sample({
        size
      })
      .end()
  }
})