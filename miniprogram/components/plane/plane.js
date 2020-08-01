// components/plane/plane.js

const placeholders = {
  welcome: ['最近有什么烦恼吗？', '不如把心事写在纸上，折一架纸飞机也许纸飞机会给你答案'],
  prepare: ['纸飞机折好了！', '手势向右滑一滑，让纸飞机起飞吧'],
  sending: ['纸飞机，飞啊飞', '还有多久才能飞回到你的手里呢']
}

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    status: {
      type: String, // welcome prepare sending mood comfort
      observer(v) {
        const placeholder = placeholders[v] || ['', '']
        this.setData({
          header: placeholder[0],
          tips: placeholder[1],
        })
      }
    },
    setStatus: {
      type: Function,
    },
    userInfo: Object,
    onGetUserInfo: {
      type: Function,
    },
  },

  /**
   * 组件的初始数据
   */
  data: {
    header: '',
    tips: ''
  },

  ready() {
    this.addListeners()
  },
  /**
   * 组件的方法列表
   */
  methods: {
    onGetUserInfo(e) {
      this.properties.onGetUserInfo(e)
      this.setStatus('mood')
    },

    addListeners() {
      wx.onAccelerometerChange(({x, y, z}) => {
          const { status } = this.properties
          if (status !== 'sending' || this.ignore || x < 1 || y < 1) return
          this.ignore = true
          this.setStatus('comfort')
          setTimeout(() => {
            this.ignore = false
          }, 1000)
      })
    },

    setStatus(status) {
      const { setStatus } = this.properties
      setStatus && setStatus(status)
    },

    onTouchStart(e) {
      if (this.properties.status !== 'prepare') return

      this.e = e.touches[0].pageX
      this.t = Date.now()
    },

    onTouchMove(e) {
      if (this.properties.status !== 'prepare') return

      this.s = e.touches[0].pageX
    },

    onTouchEnd() {
      if (this.properties.status !== 'prepare') return

      if (this.s - this.e > 50 && Date.now() - this.t < 500) {
        this.setStatus('sending')
      }
    }
  }
})
