// components/plane/plane.js

const placeholders = {
  welcome: ['最近有什么烦恼吗？', '不如把心事写在纸上，折一架纸飞机也许纸飞机会给你答案', '写点什么'],
  sending: ['纸飞机折好了！', '手势向右滑一滑，让纸飞机起飞吧'],
  sended: ['纸飞机，飞啊飞', '还有多久才能飞回到你的手里呢'],
  'recieve-mood': ['收到了一架纸飞机！', '不知从哪儿飞来的纸飞机，上面好像写了字', '拆开看看']
}

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    status: {
      type: String,
      observer(v) {
        const placeholder = placeholders[v] || ['', '', '']
        this.setData({ placeholder })
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
    placeholder: ['', '', '']
  },

  ready() {

  },
  /**
   * 组件的方法列表
   */
  methods: {
    onGetUserInfo(e) {
      this.properties.onGetUserInfo(e)
      this.setStatus('mood')
    },

    setStatus(status) {
      const { setStatus } = this.properties
      setStatus && setStatus(status)
    },

    goToComfort() {
      this.setStatus('comfort')
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
