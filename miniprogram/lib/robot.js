const token = 'ZOEpihPZqN14CK2CScmPzciwl96gEC';
const host = 'https://openai.weixin.qq.com/openapi';
const plugin = requirePlugin("chatbot");
function getSignature(openid) {
  const url = '/sign/';
  return new Promise((resolve, reject) => {
    wx.request({
      url: host + url + token,
      method: 'POST',
      data: {
        userid: openid,
      },
      success(res) {
        console.log('re',res)
        const data = res.data;
        if (data && data.signature) {
          resolve(data.signature);
        } else {
          reject();
        }
      },
      fail(e) {
        console.error(e);
        reject(e);
      }
    });
  });
}

function getKeyword(query) {
  const NOMATCH = 'NOMATCH';
  let result = '';
  const url = '/aibot/';
  const defaultId = 'default';
  return new Promise(async (resolve, reject) => {
    console.log(!query)
    if(!query) return resolve(result);
    try {
      const signature = await getSignature(defaultId);

      wx.request({
        url: host + url + token,
        method: 'POST',
        data: {
          signature: signature,
          query: query,
        },
        success(res) {
          const data = res.data;
          if (data && data.status && data.status !== NOMATCH) {
            console.log('answer', data.answer)
            result = data.title;
          }
          resolve(result);
        },
        fail(e) {
          console.error(e);
          resolve(result);
        }
      });
      return;
    } catch(e) {
      resolve(result);
    }
  });
}

function getAnswer(openid, query) {
  if(!query) {
    // 获取通用回答
    query = ' ';
  }
  const url = '/aibot/';
  return new Promise(async (resolve, reject) => {
    try {
      const signature = await getSignature(openid);
      wx.request({
        url: host + url + token,
        method: 'POST',
        data: {
          signature: signature,
          query: query,
        },
        success(res) {
          const data = res.data;
          if (data && data.answer) {
            console.log('answer', data.answer)
            resolve(data.answer);
          } else {
            resolve('sorry～网络开小差了～请稍后再来看看呢');
          }
        },
        fail(e) {
          console.error(e);
          resolve('sorry～网络开小差了～请稍后再来看看呢');
        }
      });
    } catch(e) {
      resolve('sorry～网络开小差了～请稍后再来看看呢');
    }
  });
}

function checkMsgValid(query) {
   return new Promise((resolve, reject) => {
      plugin.api.nlp('sensitive', {q: query, mode: 'cnn'}).then(res => {
        console.log("sensitive result : ", res)
        const result = res.result
        const map = {
          dirty_politics: 0,
          dirty_porno: 0,
          dirty_curse: 0,
          other: 0
        }
        if(Array.isArray(result)) {
          result.forEach(elem => {
            map[elem[0]] = elem[1]
          })
        }
        // 脏话可以通过
        const isValid = !(map.dirty_politics + map.dirty_porno > 0.5)
        resolve({
          isDirty: map.dirty_curse > 0,
          isValid: isValid
        })
      }).catch(err => {
        reject(err)
      })
      // wx.cloud.callFunction({
      //   // 云函数名称
      //   name: 'msgSecCheck',
      //   // 传给云函数的参数
      //   data: {
      //     content: query
      //   },
      // })
      // .then(res => {
      //   console.log('res', res.result)
      //   resolve(res.result)
      // })
      // .catch(err => {
      //   reject(err)
      // })
   })
}

function commonAnswer() {

}
module.exports = {
  getAnswer,
  getKeyword,
  checkMsgValid
}