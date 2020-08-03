// miniprogram/pages/paper-plane/paper-plane.js
const { getKeyword, checkMsgValid } = require('../../lib/robot')
const plugin = requirePlugin("chatbot")
const COLLECTIONS = {
  mood: 'mood',
  comfort: 'comfort',
  commonReply: 'common_reply'
}
const getRandomId = () => `${Math.random()}_${Date.now()}`

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // welcome mood sending recieve-comfort recieve-mood comfort sending sended
    status: 'welcome',
    planeVisible: true,
    mood: '生活是一段旅程并非每个人都会去同一个地方。',
    content: '',
    key: '',
    name: '',
    avatarUrl: '',
    userInfo: null,
    openId: '',
    onGetUserInfo: null,
    // 单独摇一摇的流程
    isSecond: false,
    recieve: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.init(options)
  },

  init: async function(options) {
    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
          wx.getUserInfo({
            success: res => {
              this.setData({
                avatarUrl: res.userInfo.avatarUrl,
                userInfo: res.userInfo
              })
            }
          })
        }
      }
    })

    this.setData({
      isSecond: !!options.second
    })

    this.setStatus(!!options.second ? 'recieve-mood' : 'welcome')

    this.addListeners()

    this.try(async () => {
      await this.initOpenID()
      this.db = wx.cloud.database({})
      this.setData({
        onGetUserInfo: this.onGetUserInfo,
        setStatus: this.setStatus
      })

      this.hasInited = true
    }, '初始化失败')
  },

  addListeners() {
    wx.onAccelerometerChange(({x, y, z}) => {
        if (this.ignore || x < 1 || y < 1) return
        this.ignore = true
        this.goToRecieveMood()
        setTimeout(() => {
          this.ignore = false
        }, 1000)
    })
  },

  goToRecieveMood() {
    const { status, isSecond } = this.data
    if (['welcome', 'recieve-mood'].includes(status)) return
    if (isSecond && !['sended'].includes(status)) return
    if (status === 'sended') {
      // 直接设
      this.setStatus('recieve-mood')
    } else {
      wx.navigateTo({
        url: '/pages/paper-plane/paper-plane?second=1',
      })
    }
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

  onInputConfirm(e) {
    this.setData({
      name: e.detail.value.trim()
    })
  },

  send() {
    const { status, content, userInfo, recieve, name } = this.data
    if (!content) return
    this.try(async () => {
      const isValid = await this.isValid(content + (status === 'mood' ? '' : name))
      if (!isValid) {
        // todo 提示
        return
      }

      this.setStatus('sending')

      const key = await (status === 'mood' ? this.getKey(content) : recieve.key)

      if (key) {
        const db = this.db
        const _ = db.command

        const data = {
          _id: getRandomId(),
          user_info: userInfo,
          name,
          content,
          send_time: Date.now(),
          type: status,
          key
        }

        await db.collection(COLLECTIONS[status]).add({ data })
      }
      

      this.setData({
        mood: status === 'mood' ? content : '',
        content: '',
        key
      })

      this.setStatus(status === 'mood' ? 'recieve-comfort' : 'sended')
    }, '发送失败')
  },

  async setStatus(status) {
    if (!this.data.isSecond && (!this.hasInited || !this.data.openId || !this.data.userInfo)) return

    if (['recieve-comfort', 'comfort'].includes(status)) {
      await this.pull(status)
    }

    console.log('go to', status)
    
    return new Promise((resolve) => {
      setTimeout(() => {
        this.setData({
          status,
          planeVisible: ['welcome', 'sending', 'sended', 'recieve-mood'].includes(status)
        })
        resolve
      }, 0)
    })
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

  isValid(value) {
    return checkMsgValid(value)
  },

  getKey(value) {
    return getKeyword(value)
  },

  async bot() {
    console.log('bot')
    const db = this.db
    const _ = db.command
    const { list } = await this.aggregate(COLLECTIONS.commonReply)
    let answer = '别沮丧，生活就像心电图，一帆风顺就证明你挂了。'
    let recieve = {
      name: '一位热心群众',
      content: answer
    }
    if (list.length > 0 && list[0]) {
      recieve.content = list[0].content || answer
    }
    this.setRecieve(recieve, 'recieve-comfort')
  },

  async pull(status) {
    const { key, mood } = this.data
    const db = this.db
    const _ = db.command

    // 拉一条
    if (status === 'recieve-comfort') {
      // 拉取安抚自己最近mood的comfort

      // 直接命中
      let res = await this.aggregate(
        COLLECTIONS.comfort,
        { content: _.eq(mood) }
      )
      
      if (res.list.length) {
        this.setRecieve(res.list[0], status)
        return
      }

      // 没有直接命中，根据key找
      if (!key) {
        // 全部未命中
        this.bot()
        return
      }  
      res = await this.aggregate(
        COLLECTIONS.comfort,
        { key: _.eq(key) }
      )
      
      if (res.list.length) {
        this.setRecieve(res.list[0], status)
      }
    } else {
      // 随便拉mood
      const { list } = await this.aggregate(COLLECTIONS.mood)
      if (!list.length) return
      this.setRecieve(list[0], status)
    }
  },

  setRecieve(recieve, status) {
    const data = { recieve }
    if (status === 'recieve-comfort') {
      data.name = recieve.name
      data.content = recieve.content
    } else {
      data.mood = recieve.content
      data.name = ''
    }
    this.setData(data)
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

  aggregate(collection, match = {}, size = 1) {
    const db = this.db
    const _ = db.command
    return db
      .collection(collection)
      .aggregate()
      .match({
        _openid: _.not(_.eq(this.data.openId)),
        ...match
      })
      .sample({
        size
      })
      .end()
  }
})