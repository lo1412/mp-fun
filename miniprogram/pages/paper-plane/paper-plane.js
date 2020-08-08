// miniprogram/pages/paper-plane/paper-plane.js
const { getKeyword, checkMsgValid } = require('../../lib/robot')
const plugin = requirePlugin("chatbot")
const COLLECTIONS = {
  mood: 'mood',
  comfort: 'comfort',
  commonReply: 'common_reply'
}
const getRandomId = () => `${Math.random()}_${Date.now()}`
let isDirtyWord = false
Page({
  /**
   * 页面的初始数据
   */
  data: {
    // welcome mood prepare sending sended-mood recieve-comfort recieve-mood comfort prepare sending sended-comfort
    status: 'welcome',
    planeVisible: true,
    shakeVisible: false,
    mood: '',
    content: '',
    key: '',
    name: '',
    openId: '',
    from: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.init(options)
  },

  init: async function(options) {
    const status = options.status || 'welcome'
    this.setData({
      key: options.key || '',
      openId: options.openId || '',
      name: status === 'comfort' ? '' : (options.name || ''),
      mood: options.mood || '生活是一段旅程，并非每个人都会去同一个地方。',
      content: options.content || '',
      status,
      planeVisible: ['welcome', 'sending', 'sended-mood', 'recieve-mood', 'prepare', 'sended-comfort'].includes(status),
      shakeVisible: status === 'recieve-comfort',
      from: options.from || '',
    })
    this.addListeners()
    this.try(async () => {
      if (!options.openId) {
        await this.initOpenID()
      }
      this.db = wx.cloud.database({})
      this.setData({
        goTo: this.goTo,
        send: this.send
      })
      this.hasInited = true
    }, '初始化失败')
  },

  addListeners() {
    wx.onAccelerometerChange(({x, y, z}) => {
        if (this.ignore || x < 1 || y < 1) return
        this.ignore = true
        this.goToRecieveMood()
        wx.vibrateShort()
        setTimeout(() => {
          this.ignore = false
        }, 1000)
    })
  },

  goToRecieveMood() {
    if (!this.data.shakeVisible) return
    this.goTo('recieve-mood')
  },

  initOpenID: async function() {
    const { result } = await wx.cloud.callFunction({ name: 'login', })
    this.setData({ openId: result.openid })
  },

  onConfirm(e) {
    this.setData({ content: e.detail.value.trim() })
  },

  onInputConfirm(e) {
    this.setData({ name: e.detail.value.trim() })
  },

  async goToPrepare() {
    let { content, name, from } = this.data
    if (!content) return
    const { isValid, isDirty } = await this.isValid(content + ',' + (from === 'mood' ? '' : name))
    if (!isValid || isDirty) {
      const title = !isValid ? '很遗憾，纸飞机上也不能写敏感词汇...' : '世界如此美妙我却如此暴躁这样不好，不好'
      wx.showToast({
        title: title,
        icon: 'none'
      })
      return
    }
    isDirtyWord = isDirty;
    this.goTo('prepare')
  },

  send() {
    let { content, name, key, from } = this.data
   
    if (!content) return
    this.try(async () => {
      if (from === 'mood') {
        key = await this.getKey(content)
      }
      if (key && !isDirtyWord) {
        const db = this.db
        const _ = db.command
        const data = {
          _id: getRandomId(),
          name,
          content,
          send_time: Date.now(),
          type: from,
          key
        }
        await db.collection(COLLECTIONS[from]).add({ data })
      }
      this.setData({
        mood: from === 'mood' ? content : '',
        content: '',
        key
      })
      this.goTo(from === 'mood' ? 'sended-mood' : 'sended-comfort')
    }, '发送失败')
  },

  async goTo(status) {
    if (!this.hasInited || !this.data.openId) return
    if (['recieve-comfort', 'comfort'].includes(status)) {
      await this.pull(status)
    }
    const query = ['openId', 'status', 'key', 'mood', 'content', 'name', 'from'].reduce((r, key, i) => {
      let value = this.data[key]
      if (key === 'status') {
        value = status
      }
      if (key === 'from') {
        value = this.data.status !== 'prepare' ? this.data.status : this.data.from
      }
      return r + (i ? '&' : '?') + key + '=' + value
    }, '')
    wx[getCurrentPages().length > 1 ? 'redirectTo' : 'navigateTo']({
      url: '/pages/paper-plane/paper-plane' + query,
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
    const db = this.db
    const _ = db.command
    const { list } = await this.aggregate(COLLECTIONS.commonReply)
    let answer = '别沮丧，生活就像心电图，一帆风顺就证明你挂了。'
    const recieve = {
      name: '一位热心群众',
      content: answer
    }
    if (list.length > 0 && list[0]) {
      recieve.content = list[0].content || answer
    }
    this.onRecieve(recieve, 'recieve-comfort')
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
      if (res.list.length) return this.onRecieve(res.list[0], status)
      // 没有直接命中，根据key找
      if (!key) return this.bot()
      res = await this.aggregate(
        COLLECTIONS.comfort,
        { key: _.eq(key) }
      )
      if (res.list.length) return this.onRecieve(res.list[0], status)
    } else {
      // 随便拉mood
      const { list } = await this.aggregate(COLLECTIONS.mood)
      if (!list.length) return
      this.onRecieve(list[0], status)
    }
  },

  onRecieve(recieve, status) {
    const data = {}
    if (status === 'recieve-comfort') {
      data.name = recieve.name
      data.content = recieve.content
    } else {
      data.mood = recieve.content
      data.key = recieve.key
      data.name = ''
      data.content = ''
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