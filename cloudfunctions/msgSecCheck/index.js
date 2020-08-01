// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  // API 调用都保持和云函数当前所在环境一致
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  if(!event.content) return true;
  try {
    const result = await cloud.openapi.security.msgSecCheck({content: event.content})
    return true
  } catch (err) {
    // 错误处理
    // 有敏感词的情况
    if(err && err.errCode == 87014) return false
    // 其他错误
    throw err
  }
}