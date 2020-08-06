const plugin = requirePlugin("chatbot")
//app.js
App({
  onLaunch: function () {
    
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        // env: 'my-env-id',
        traceUser: true,
      })
      // plugin.init({
      //   appid: "ZOEpihPZqN14CK2CScmPzciwl96gEC",
      //   openid: "", //用户的openid，非必填，建议传递该参数
      //   success: () => {}, //非必填
      //   fail: (error) => {}, //非必填
      // })
    }

    this.globalData = {}

    // wx.loadFontFace({
    //   family: 'Bitstream Vera Serif Bold',
    //   source: 'https://use.typekit.net/af/14981c/00000000000000003b9b465a/27/m?unicode=AAAI8wAAAAeNOFyE9s3tKS7kbg5GWNzZy_lOhCmt5m_e6JjkBEiK3HcE5ksUcw5J1ESt-Krk8QoJo2db2PMylo6oWoQ7YkRFTkyI5c1CFNL7kr65Bc9vF4pxExHRO32CoR_kEPERu-5_ha2ogvcUfdt6Zdl7763VeeIbUXBt5fH5H4G70WJ_8JGrrErRdGTjGRPpDKazGx7vgUQ32ceqbWJ7ts0hvKDfCGzj2O8-HwPchKleGXeAW0loB6Z3TlRTqxjdr4uwJu7DoKeW48s2CHW34NLmKWL9OsuQCTH0O_P0sZNXNpvL5MPX1wo_MYDz57zEdpZKitZaIt266KB-Zz_ntgcb90grz1Uuy5W-0RZj6gBhVKL_ZbdvqrEwbZQriyn0mAAC_E4&features=ALL&v=3',
    //   complete(e) {
    //     console.log(e)
    //   }
    // })
  }
})
