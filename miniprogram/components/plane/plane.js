// components/plane/plane.js

const placeholders = {
  welcome: ['最近有什么烦恼吗？', '不如把心事写在纸上，折一架纸飞机也许纸飞机会给你答案', '写点什么'],
  prepare: ['纸飞机折好了！', '手势向右滑一滑，让纸飞机起飞吧'],
  sending: ['纸飞机，飞啊飞', '还有多久才能飞回到你的手里呢'],
  'sended-mood': ['纸飞机飞了回来', '上面好像写了字', '拆开看看'],
  'recieve-mood': ['收到了一架纸飞机！', '不知从哪儿飞来的纸飞机，上面好像写了字', '拆开看看'],
  'sended-comfort': ['纸飞机飞远了', '会有人收到它', '好的']
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
    goTo: {
      type: Function,
    },
  },

  /**
   * 组件的初始数据
   */
  data: {
    placeholder: ['', '', ''],
    sending: false
  },

  ready() {

  },
  /**
   * 组件的方法列表
   */
  methods: {
    toToMood() {
      this.goTo('mood')
    },

    goTo(status) {
      const { goTo } = this.properties
      goTo && goTo(status)
    },

    goToComfort() {
      this.goTo('comfort')
    },

    goToRecieveComfort() {
      this.goTo('recieve-comfort')
    },

    goToRecieveMood() {
      this.goTo('recieve-mood')
    },

    onTouchStart(e) {
      if (this.properties.status !== 'prepare' || this.data.sending) return

      this.e = e.touches[0].pageX
      this.t = Date.now()
    },

    onTouchMove(e) {
      if (this.properties.status !== 'prepare' || this.data.sending) return

      this.s = e.touches[0].pageX
    },

    onTouchEnd() {
      if (this.properties.status !== 'prepare' || this.data.sending) return

      if (this.s - this.e > 50 && Date.now() - this.t < 500) {
        this.setData({ sending: true })
        setTimeout(() => {
          this.goTo('sending')
        }, 2000)
      }
    }
  }
})
