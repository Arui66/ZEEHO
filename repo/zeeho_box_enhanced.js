/*
#!name=极核 ZEEHO 签到面板 V2.14.0
#!desc=极核ZEEHO多账号签到面板 + 网页配置，访问 http://zeeho.box
#!author=lucky
#!homepage=https://github.com/mlink798/ZEEHO
#!version=2.14.0

图标: https://cdn.jsdelivr.net/gh/mlink798/ZEEHO@main/ZEEHO.png

[Script]
# ========== 极核 ZEEHO ==========
# 面板 + 极核API自动捕获appId/appSecret
http-request ^https?://(zeeho\.box|.*zeehoev\.com)/.* script-path=https://raw.githubusercontent.com/mlink798/ZEEHO/refs/heads/main/repo/zeeho_box_enhanced.js, requires-body=true, timeout=60, tag=极核面板V2.14.0

# 极核Token自动捕获（打开极核App-我的页面）
http-response ^https:\/\/tapi\.zeehoev\.com\/v1\.0\/mine\/cfmotoservermine\/setting script-path=https://raw.githubusercontent.com/mlink798/ZEEHO/refs/heads/main/repo/zeeho.js, requires-body=true, timeout=30, tag=极核抓Token

# 极核每日签到（每天7点）
cron "0 7 * * *" script-path=https://raw.githubusercontent.com/mlink798/ZEEHO/refs/heads/main/repo/zeeho.js, timeout=120, tag=极核每日签到


[MITM]
hostname = tapi.zeehoev.com, h5.zeehoev.com, zeeho.box

====================================
⚠️【免责声明】
------------------------------------------
1、此脚本仅用于学习研究，不保证其合法性、准确性、有效性，请根据情况自行判断，本人对此不承担任何保证责任。
2、由于此脚本仅用于学习研究，您必须在下载后 24 小时内将所有内容从您的计算机或手机或任何存储设备中完全删除，若违反规定引起任何事件本人对此均不负责。
3、请勿将此脚本用于任何商业或非法目的，若违反规定请自行对此负责。
4、此脚本涉及应用与本人无关，本人对因此引起的任何隐私泄漏或其他后果不承担任何责任。
5、本人对任何脚本引发的问题概不负责，包括但不限于由脚本错误引起的任何损失和损害。
6、如果任何单位或个人认为此脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明，所有权证明，我们将在收到认证文件确认后删除此脚本。
7、所有直接或间接使用、查看此脚本的人均应该仔细阅读此声明。本人保留随时更改或补充此声明的权利。一旦您使用或复制了此脚本，即视为您已接受此免责声明。
 */

const $ = new Env("极核看板增强版");

// ========== 极核 ZEEHO 签到面板脚本 ==========
// 版本: v2.14.0
// 更新日期: 2026-09-25
// 作者: @lucky
// 主页: https://github.com/mlink798/ZEEHO
// ============================================
const SCRIPT_VERSION = "v2.14.0";
console.log(`🚀 [极核面板] 脚本版本: ${SCRIPT_VERSION} (2026-09-25 v2.14.0 新增LITE设置页手机号登录：免抓包，手机号+短信验证码自动获取Token与用户ID并写入账号列表)`);

// 面板入口域名：Loon 用虚拟域名 zeeho.box（Loon 可虚拟劫持不存在的域名），
// QX 必须用真实可解析域名（默认 www.example.com，IANA 保留域名保证可解析）。
// 从当前请求自动推断，面板内绝对链接统一用 PANEL_HOST。
let PANEL_HOST = "http://zeeho.box";

// ========== 自动捕获 appId/appSecret ==========
// 匹配规则需同时覆盖 zeeho.box 和极核API：^https?://(zeeho\\.box|.*zeehoev\\.com)/.*
// 打开极核App时，API请求被拦截 → 自动提取appId保存 → 放行请求
(async function autoCapture() {
  try {
    const url = $request.url;


    // 只处理极核API请求（zeehoev.com），zeeho.box 走面板逻辑
    if (!url.includes('zeehoev.com')) return;
    
    const headers = $request.headers;
    const param = headers['cfmoto-x-param'] || headers['Cfmoto-X-Param'] || headers['CFMOTO-X-PARAM'] || '';
    const match = param.match(/appId=([^&]+)/i);
    
    if (match) {
      const appId = match[1];
      const type = url.includes('h5.zeehoev.com') ? 'h5' : 'app';
      const typeName = type === 'h5' ? 'H5端' : 'App端';
      
      // 已知的 appSecret（无法从请求自动捕获，需手动配置）
      const knownSecrets = {
        'Sw5F9uJi': '46870a8f678a09109468f5b0168818b91c292845',
        'S7qPWPU1': 'c5e0da7f4da28df805694ec3dd1fc6792e9df99d'
      };
      const appSecret = knownSecrets[appId] || '';
      
      // 保存到 $persistentStore
      const idKey = type === 'h5' ? 'zeeho_h5_appId' : 'zeeho_app_appId';
      const secretKey = type === 'h5' ? 'zeeho_h5_appSecret' : 'zeeho_app_appSecret';
      const savedId = $persistentStore.read(idKey);
      
      if (savedId !== appId) {
        $persistentStore.write(appId, idKey);
        if (appSecret) $persistentStore.write(appSecret, secretKey);
        console.log('[极核捕获] ' + typeName + ' appId已保存: ' + appId);
      }
    }
    
    // ⚠️ 关键：捕获完成后必须放行请求，否则极核App会卡住
    $done({});
    return true; // 标记已处理，阻止后续面板逻辑执行
  } catch(e) {
    console.log('[极核捕获] 异常:', e);
    $done({});
    return true;
  }
})();


// ========== 存储键名 ==========
const CK_CONFIG = "zeeho_config";
const CK_DATA = "zeeho_data";
const CK_LOGS = "zeeho_logs";

// ========== 默认配置 ==========
// 看板自动刷新间隔(秒)规范化：最小15秒、最大3600秒，0/非法/缺失一律回退60秒，避免配置成0导致疯狂刷新
function normalizeRefreshSec(v) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return 60;
  return Math.max(15, Math.min(3600, Math.round(n)));
}
const DEFAULT_CONFIG = {
  app: { appId: "S7qPWPU1", appSecret: "c5e0da7f4da28df805694ec3dd1fc6792e9df99d" },
  h5:  { appId: "Sw5F9uJi", appSecret: "46870a8f678a09109468f5b0168818b91c292845" },
  community: { enablePost: true, enableLike: true, enableComment: true, enableShare: true, enableDelete: true },
  vehicleAesKey: "", // 云端开/关锁AES-256-ECB密钥(32位)。默认留空不内置，需用户在配置页手动填写并保存后才能使用云端开/关锁（防滥用）
  autoRefreshSec: 60 // 看板首页自动刷新间隔(秒)，配置页可改；规范化见 normalizeRefreshSec
};

// ========== 版本信息 ==========
// ========== 配置读写 ==========
function getConfig() {
  // 从捕获脚本保存的 $persistentStore 读取（zeeho_h5_appId / zeeho_app_appId）
  let storeApp = { appId: '', appSecret: '' };
  let storeH5 = { appId: '', appSecret: '' };
  try {
    storeApp.appId = $persistentStore.read('zeeho_app_appId') || '';
    storeApp.appSecret = $persistentStore.read('zeeho_app_appSecret') || '';
    storeH5.appId = $persistentStore.read('zeeho_h5_appId') || '';
    storeH5.appSecret = $persistentStore.read('zeeho_h5_appSecret') || '';
  } catch(e) {}
  try {
    const raw = $.getdata(CK_CONFIG);
    if (raw) {
      const c = JSON.parse(raw);
      return {
        // 优先级：看板配置 > 捕获脚本 > 默认值
        app: { appId: c.app?.appId || storeApp.appId || DEFAULT_CONFIG.app.appId, appSecret: c.app?.appSecret || storeApp.appSecret || DEFAULT_CONFIG.app.appSecret },
        h5:  { appId: c.h5?.appId || storeH5.appId || DEFAULT_CONFIG.h5.appId, appSecret: c.h5?.appSecret || storeH5.appSecret || DEFAULT_CONFIG.h5.appSecret },
        community: { enablePost: c.community?.enablePost !== false, enableLike: c.community?.enableLike !== false, enableComment: c.community?.enableComment !== false, enableShare: c.community?.enableShare !== false, enableDelete: c.community?.enableDelete !== false },
        vehicleAesKey: (typeof c.vehicleAesKey === "string" ? c.vehicleAesKey : "").trim(),
        autoRefreshSec: normalizeRefreshSec(c.autoRefreshSec)
      };
    }
  } catch(e) {}
  // 看板无配置时，使用捕获脚本配置 + 默认值
  return {
    app: { appId: storeApp.appId || DEFAULT_CONFIG.app.appId, appSecret: storeApp.appSecret || DEFAULT_CONFIG.app.appSecret },
    h5:  { appId: storeH5.appId || DEFAULT_CONFIG.h5.appId, appSecret: storeH5.appSecret || DEFAULT_CONFIG.h5.appSecret },
    community: JSON.parse(JSON.stringify(DEFAULT_CONFIG.community)),
    vehicleAesKey: "",
    autoRefreshSec: 60
  };
}
function saveConfig(cfg) {
  try { $.setdata(JSON.stringify(cfg), CK_CONFIG); return true; } catch(e) { return false; }
}

// ========== 账号读写 ==========
function getAccounts() {
  try {
    const raw = $.getdata(CK_DATA);
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [arr];
    }
  } catch(e) {}
  return [];
}
function saveAccounts(list) {
  try { $.setdata(JSON.stringify(list), CK_DATA); return true; } catch(e) { return false; }
}

// ========== 运行日志 ==========
function getLogs() {
  try {
    const raw = $.getdata(CK_LOGS);
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }
  } catch(e) {}
  return [];
}
function addLog(entry) {
  try {
    const logs = getLogs();
    logs.unshift(entry);
    if (logs.length > 50) logs.length = 50;
    $.setdata(JSON.stringify(logs), CK_LOGS);
    return true;
  } catch(e) { return false; }
}
function clearLogs() {
  try { $.setdata("[]", CK_LOGS); return true; } catch(e) { return false; }
}


// ========== 工具函数 ==========
function getUuid() {
  const p = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx", c = "abcdef0123456789";
  let r = "";
  for (const ch of p) {
    if (ch === "x" || ch === "y") {
      const n = Math.floor(Math.random() * 16);
      r += (ch === "y" ? (n & 0x3) | 0x8 : n).toString(16);
    } else r += ch;
  }
  return r;
}
function getRandomChars(n = 16) {
  const c = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let r = ""; for (let i = 0; i < n; i++) r += c.charAt(Math.floor(Math.random() * c.length)); return r;
}
function toQuery(p = {}) {
  return Object.keys(p).filter(k => p[k] !== undefined && p[k] !== null).sort()
    .map(k => `${k}=${p[k]}`).join("&");
}
function cleanToken(t) {
  return String(t || "").trim().replace(/^[bB]earer\s+/i, "").replace(/[\s"'`]+/g, "");
}
// 清洗 Bark Key：官方完整链接 https://api.day.app/xxx 只保留 xxx；纯Key原样；自建服务器完整地址保留
function cleanBarkKey(k) {
  let s = String(k || "").trim().replace(/^[bB]ark\s*(key)?\s*[:：]\s*/i, "").replace(/[\s"'`]+/g, "").trim();
  s = s.replace(/^https?:\/\/api\.day\.app\//i, "");
  return s.replace(/\/+$/, "");
}
// 车架号脱敏：保留前3位+后4位，中间打码（默认不展示完整VIN，点击按钮才显示）
function maskVin(v) {
  const s = String(v || "");
  if (!s) return "";
  if (s.length <= 7) return "****";
  return s.substring(0, 3) + "****" + s.substring(s.length - 4);
}

// ========== md5 / sha1 ==========
function md5(t,e){function n(t,e){return t<<e|t>>>32-e}function r(t,e){var n,r,o,i,a;return o=2147483648&t,i=2147483648&e,a=(1073741823&t)+(1073741823&e),(n=1073741824&t)&(r=1073741824&e)?2147483648^a^o^i:n|r?1073741824&a?3221225472^a^o^i:1073741824^a^o^i:a^o^i}function o(t,e,o,i,a,u,c){return t=r(t,r(r(function(t,e,n){return t&e|~t&n}(e,o,i),a),c)),r(n(t,u),e)}function i(t,e,o,i,a,u,c){return t=r(t,r(r(function(t,e,n){return t&n|e&~n}(e,o,i),a),c)),r(n(t,u),e)}function a(t,e,o,i,a,u,c){return t=r(t,r(r(function(t,e,n){return t^e^n}(e,o,i),a),c)),r(n(t,u),e)}function u(t,e,o,i,a,u,c){return t=r(t,r(r(function(t,e,n){return e^(t|~n)}(e,o,i),a),c)),r(n(t,u),e)}function c(t){var e,n="",r="";for(e=0;e<=3;e++)n+=(r="0"+(t>>>8*e&255).toString(16)).substr(r.length-2,2);return n}var s,l,f,p,d,h,v,y,g,m=Array();for(m=function(t){for(var e,n=t.length,r=n+8,o=16*((r-r%64)/64+1),i=Array(o-1),a=0,u=0;u<n;)a=u%4*8,i[e=(u-u%4)/4]=i[e]|t.charCodeAt(u)<<a,u++;return a=u%4*8,i[e=(u-u%4)/4]=i[e]|128<<a,i[o-2]=n<<3,i[o-1]=n>>>29,i}(t=function(t){t=t.replace(/\r\n/g,"\n");for(var e="",n=0;n<t.length;n++){var r=t.charCodeAt(n);r<128?e+=String.fromCharCode(r):r>127&&r<2048?(e+=String.fromCharCode(r>>6|192),e+=String.fromCharCode(63&r|128)):(e+=String.fromCharCode(r>>12|224),e+=String.fromCharCode(r>>6&63|128),e+=String.fromCharCode(63&r|128))}return e}(t)),h=1732584193,v=4023233417,y=2562383102,g=271733878,s=0;s<m.length;s+=16)l=h,f=v,p=y,d=g,h=o(h,v,y,g,m[s+0],7,3614090360),g=o(g,h,v,y,m[s+1],12,3905402710),y=o(y,g,h,v,m[s+2],17,606105819),v=o(v,y,g,h,m[s+3],22,3250441966),h=o(h,v,y,g,m[s+4],7,4118548399),g=o(g,h,v,y,m[s+5],12,1200080426),y=o(y,g,h,v,m[s+6],17,2821735955),v=o(v,y,g,h,m[s+7],22,4249261313),h=o(h,v,y,g,m[s+8],7,1770035416),g=o(g,h,v,y,m[s+9],12,2336552879),y=o(y,g,h,v,m[s+10],17,4294925233),v=o(v,y,g,h,m[s+11],22,2304563134),h=o(h,v,y,g,m[s+12],7,1804603682),g=o(g,h,v,y,m[s+13],12,4254626195),y=o(y,g,h,v,m[s+14],17,2792965006),h=i(h,v=o(v,y,g,h,m[s+15],22,1236535329),y,g,m[s+1],5,4129170786),g=i(g,h,v,y,m[s+6],9,3225465664),y=i(y,g,h,v,m[s+11],14,643717713),v=i(v,y,g,h,m[s+0],20,3921069994),h=i(h,v,y,g,m[s+5],5,3593408605),g=i(g,h,v,y,m[s+10],9,38016083),y=i(y,g,h,v,m[s+15],14,3634488961),v=i(v,y,g,h,m[s+4],20,3889429448),h=i(h,v,y,g,m[s+9],5,568446438),g=i(g,h,v,y,m[s+14],9,3275163606),y=i(y,g,h,v,m[s+3],14,4107603335),v=i(v,y,g,h,m[s+8],20,1163531501),h=i(h,v,y,g,m[s+13],5,2850285829),g=i(g,h,v,y,m[s+2],9,4243563512),y=i(y,g,h,v,m[s+7],14,1735328473),h=a(h,v=i(v,y,g,h,m[s+12],20,2368359562),y,g,m[s+5],4,4294588738),g=a(g,h,v,y,m[s+8],11,2272392833),y=a(y,g,h,v,m[s+11],16,1839030562),v=a(v,y,g,h,m[s+14],23,4259657740),h=a(h,v,y,g,m[s+1],4,2763975236),g=a(g,h,v,y,m[s+4],11,1272893353),y=a(y,g,h,v,m[s+7],16,4139469664),v=a(v,y,g,h,m[s+10],23,3200236656),h=a(h,v,y,g,m[s+13],4,681279174),g=a(g,h,v,y,m[s+0],11,3936430074),y=a(y,g,h,v,m[s+3],16,3572445317),v=a(v,y,g,h,m[s+6],23,76029189),h=a(h,v,y,g,m[s+9],4,3654602809),g=a(g,h,v,y,m[s+12],11,3873151461),y=a(y,g,h,v,m[s+15],16,530742520),h=u(h,v=a(v,y,g,h,m[s+2],23,3299628645),y,g,m[s+0],6,4096336452),g=u(g,h,v,y,m[s+7],10,1126891415),y=u(y,g,h,v,m[s+14],15,2878612391),v=u(v,y,g,h,m[s+5],21,4237533241),h=u(h,v,y,g,m[s+12],6,1700485571),g=u(g,h,v,y,m[s+3],10,2399980690),y=u(y,g,h,v,m[s+10],15,4293915773),v=u(v,y,g,h,m[s+1],21,2240044497),h=u(h,v,y,g,m[s+8],6,1873313359),g=u(g,h,v,y,m[s+15],10,4264355552),y=u(y,g,h,v,m[s+6],15,2734768916),v=u(v,y,g,h,m[s+13],21,1309151649),h=u(h,v,y,g,m[s+4],6,4149444226),g=u(g,h,v,y,m[s+11],10,3174756917),y=u(y,g,h,v,m[s+2],15,718787259),v=u(v,y,g,h,m[s+9],21,3951481745),h=r(h,l),v=r(v,f),y=r(y,p),g=r(g,d);return 32==e?(c(h)+c(v)+c(y)+c(g)).toLowerCase():(c(v)+c(y)).toLowerCase()}
function sha1(msg){function rotate_left(n,s){var t4=(n<<s)|(n>>>(32-s));return t4};function cvt_hex(val){var str='';var i;var v;for(i=7;i>=0;i--){v=(val>>>(i*4))&0x0f;str+=v.toString(16)}return str};function Utf8Encode(string){string=string.replace(/\r\n/g,'\n');var utftext='';for(var n=0;n<string.length;n++){var c=string.charCodeAt(n);if(c<128){utftext+=String.fromCharCode(c)}else if((c>127)&&(c<2048)){utftext+=String.fromCharCode((c>>6)|192);utftext+=String.fromCharCode((c&63)|128)}else{utftext+=String.fromCharCode((c>>12)|224);utftext+=String.fromCharCode(((c>>6)&63)|128);utftext+=String.fromCharCode((c&63)|128)}}return utftext};var blockstart;var i,j;var W=new Array(80);var H0=0x67452301;var H1=0xEFCDAB89;var H2=0x98BADCFE;var H3=0x10325476;var H4=0xC3D2E1F0;var A,B,C,D,E;var temp;msg=Utf8Encode(msg);var msg_len=msg.length;var word_array=new Array();for(i=0;i<msg_len-3;i+=4){j=msg.charCodeAt(i)<<24|msg.charCodeAt(i+1)<<16|msg.charCodeAt(i+2)<<8|msg.charCodeAt(i+3);word_array.push(j)}switch(msg_len%4){case 0:i=0x080000000;break;case 1:i=msg.charCodeAt(msg_len-1)<<24|0x0800000;break;case 2:i=msg.charCodeAt(msg_len-2)<<24|msg.charCodeAt(msg_len-1)<<16|0x08000;break;case 3:i=msg.charCodeAt(msg_len-3)<<24|msg.charCodeAt(msg_len-2)<<16|msg.charCodeAt(msg_len-1)<<8|0x80;break}word_array.push(i);while((word_array.length%16)!=14)word_array.push(0);word_array.push(msg_len>>>29);word_array.push((msg_len<<3)&0x0ffffffff);for(blockstart=0;blockstart<word_array.length;blockstart+=16){for(i=0;i<16;i++)W[i]=word_array[blockstart+i];for(i=16;i<=79;i++)W[i]=rotate_left(W[i-3]^W[i-8]^W[i-14]^W[i-16],1);A=H0;B=H1;C=H2;D=H3;E=H4;for(i=0;i<=19;i++){temp=(rotate_left(A,5)+((B&C)|(~B&D))+E+W[i]+0x5A827999)&0x0ffffffff;E=D;D=C;C=rotate_left(B,30);B=A;A=temp}for(i=20;i<=39;i++){temp=(rotate_left(A,5)+(B^C^D)+E+W[i]+0x6ED9EBA1)&0x0ffffffff;E=D;D=C;C=rotate_left(B,30);B=A;A=temp}for(i=40;i<=59;i++){temp=(rotate_left(A,5)+((B&C)|(B&D)|(C&D))+E+W[i]+0x8F1BBCDC)&0x0ffffffff;E=D;D=C;C=rotate_left(B,30);B=A;A=temp}for(i=60;i<=79;i++){temp=(rotate_left(A,5)+(B^C^D)+E+W[i]+0xCA62C1D6)&0x0ffffffff;E=D;D=C;C=rotate_left(B,30);B=A;A=temp}H0=(H0+A)&0x0ffffffff;H1=(H1+B)&0x0ffffffff;H2=(H2+C)&0x0ffffffff;H3=(H3+D)&0x0ffffffff;H4=(H4+E)&0x0ffffffff}var temp=cvt_hex(H0)+cvt_hex(H1)+cvt_hex(H2)+cvt_hex(H3)+cvt_hex(H4);return temp.toLowerCase()}

// ========== 签名函数（使用配置中的密钥） ==========
function getSign(type, params = {}, body = '', cfg) {
  const c = cfg || getConfig();
  const ac = c[type] || c.app;
  const query = toQuery(params);
  const timestamp = new Date().getTime();
  const nonce = type === "h5" ? getUuid() : timestamp + getRandomChars();
  const param = `appId=${ac.appId}&nonce=${nonce}&timestamp=${timestamp}`;
  const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
  const signature = type === "h5" ? `${query}${param}${ac.appSecret}` : `${bodyStr}${param}${ac.appSecret}`;
  const sign = md5(sha1(signature), 32).toString();
  // 按官方App真实请求头同时下发：cfmoto-x-* 三件套 + 独立 timestamp/nonce/signature（signature 与 sign 同值，官方冗余发送）
  return {
    'cfmoto-x-param': param,
    'cfmoto-x-sign': sign,
    'cfmoto-x-sign-type': '0',
    'timestamp': String(timestamp),
    'nonce': nonce,
    'signature': sign
  };
}

// H5 端含 body 签名：极核 loginByPhone 等接口必须把请求体纳入签名，
// 默认 getSign('h5') 不含 body，直接用于登录会返回 permit error。
function h5SignWithBody(body, cfg) {
  const c = cfg || getConfig();
  const ac = c.h5 || c.app;
  const timestamp = new Date().getTime();
  const nonce = getUuid();
  const param = `appId=${ac.appId}&nonce=${nonce}&timestamp=${timestamp}`;
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const sign = md5(sha1(bodyStr + param + ac.appSecret), 32).toString();
  return {
    'cfmoto-x-param': param,
    'cfmoto-x-sign': sign,
    'cfmoto-x-sign-type': '0',
    'timestamp': String(timestamp),
    'nonce': nonce,
    'appId': ac.appId
  };
}

// ========== HTTP 请求 ==========
function httpGet(url, headers) {
  return new Promise((resolve) => {
    const isQX = typeof $task !== "undefined";
    if (isQX) {
      $task.fetch({ url, headers, method: "GET" }).then(
        function(resp) {
          try { resolve(JSON.parse(resp.body)); }
          catch(e) { resolve({ error: "parse error", raw: resp.body }); }
        },
        function(err) { resolve({ error: String(err && err.error || err || "request failed") }); }
      );
    } else {
      $httpClient.get({ url, headers }, function(err, resp, body) {
        if (err) { resolve({ error: String(err) }); return; }
        try { resolve(JSON.parse(body)); } catch(e) { resolve({ error: "parse error", raw: body }); }
      });
    }
  });
}

// ========== 单账号 Bark 推送（仅该账号签到成功后通知） ==========
// barkKey 支持两种填法：①只填 Bark App 内的 Key（走官方 https://api.day.app）；②自建服务器完整地址 https://域名/Key
function barkPush(barkKey, title, body) {
  try {
    const k = cleanBarkKey(barkKey);
    if (!k) return Promise.resolve({ skipped: true });
    let base = "https://api.day.app";
    let key = k;
    const m = k.match(/^(https?:\/\/[^/]+)\/(.+)$/i);
    if (m) { base = m[1]; key = m[2]; }   // 自建服务器
    key = key.replace(/^\/+/, "");
    const u = base + "/" + encodeURIComponent(key)
      + "/" + encodeURIComponent(title)
      + "/" + encodeURIComponent(body)
      + "?group=ZEEHO&sound=birdsong";
    return httpGet(u, {});
  } catch(e) { return Promise.resolve({ error: String(e) }); }
}


// ========== Token 状态检测 ==========
async function checkToken(acc, cfg) {
  try {
    const token = cleanToken(acc.token);
    const userId = acc.userId || "";
    // userId 为空时不检测，直接认为有效（避免误判）
    if (!userId) {
      return { valid: true, score: 0, userName: acc.userName };
    }
    const signH = getSign("app", {}, '', cfg);
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
      "interfaceversion": "2",
      "user_id": userId,
      ...signH
    };
    const res = await httpGet(
      `https://tapi.zeehoev.com/v1.0/mine/cfmotoservermine/setting/${userId}`,
      headers
    );
    if (res.code == "10000" && res.data) {
      return { valid: true, score: Number(res.data.score) || 0, userName: res.data.nickName || acc.userName };
    }
    if (res.code == "40001" || res.code == 401) {
      return { valid: false, reason: "token已过期" };
    }
    // 其他错误不判定为失效，避免网络问题误判
    return { valid: true, reason: res.message || "请求异常" };
  } catch(e) {
    // 异常不判定为失效
    return { valid: true, reason: String(e) };
  }
}

// ========== 手动执行签到（单账号） ==========
async function runSigninForAccount(acc, cfg) {
  const result = { userName: acc.userName || "未知", userId: acc.userId, success: false, signinScore: 0, blindBoxScore: 0, interactScore: 0, totalGain: 0, continueDays: 0, error: null, steps: [] };
  try {
    const token = cleanToken(acc.token);
    const userId = acc.userId || "";
    const baseHeaders = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
      "interfaceversion": "2",
      "user_id": userId
    };
    const today = new Date().getFullYear() + "-" + String(new Date().getMonth()+1).padStart(2,"0") + "-" + String(new Date().getDate()).padStart(2,"0");
    const month = today.slice(0,7);

    // 1. 签到
    try {
      const infoRes = await httpGet(`https://h5.zeehoev.com/cfmotoservermine/signin/info?month=${month}`, { ...baseHeaders, ...getSign("h5", { month }, '', cfg) });
      const todayEntry = (infoRes?.data?.nowSignDetailVos || []).find(x => x.createDate === today);
      if (todayEntry && (todayEntry.signStatue == 3 || todayEntry.signStatue == 5)) {
        result.steps.push("今日已签到");
      } else {
        // 多账号连签易触发“请稍后/操作频繁”限流，退避后最多重试3次
        let signRes = null, signMsg = "未知";
        for (let at = 1; at <= 3; at++) {
          signRes = await httpPost(`https://h5.zeehoev.com/cfmotoservermine/signin`, { ...baseHeaders, ...getSign("h5", {}, '', cfg) }, {});
          if (signRes?.code == "10000") break;
          signMsg = signRes?.message || "未知";
          if (/请稍|稍后|稍候|频繁|繁忙|重试/.test(signMsg) && at < 3) {
            await new Promise(r => setTimeout(r, (at + 1) * 2000));
            continue;
          }
          break;
        }
        if (signRes?.code == "10000") {
          const infoRes2 = await httpGet(`https://h5.zeehoev.com/cfmotoservermine/signin/info?month=${month}`, { ...baseHeaders, ...getSign("h5", { month }, '', cfg) });
          const te = (infoRes2?.data?.nowSignDetailVos || []).find(x => x.createDate === today);
          result.signinScore = te ? (Number(te.integralScore) || 0) : 0;
          result.steps.push(`签到成功 +${result.signinScore}`);
        } else {
          // 重试后仍未成功：回查今日是否其实已签上
          try {
            const chk = await httpGet(`https://h5.zeehoev.com/cfmotoservermine/signin/info?month=${month}`, { ...baseHeaders, ...getSign("h5", { month }, '', cfg) });
            const ce = (chk?.data?.nowSignDetailVos || []).find(x => x.createDate === today);
            if (ce && (ce.signStatue == 3 || ce.signStatue == 5)) result.steps.push("今日已签到");
            else result.steps.push(`签到失败: ${signMsg}`);
          } catch(e) { result.steps.push(`签到失败: ${signMsg}`); }
        }
      }
    } catch(e) { result.steps.push(`签到异常: ${e}`); }

    // 2. 查询连签和盲盒
    try {
      const infoRes = await httpGet(`https://h5.zeehoev.com/cfmotoservermine/signin/info?month=${month}`, { ...baseHeaders, ...getSign("h5", { month }, '', cfg) });
      const list = infoRes?.data?.nowSignDetailVos || [];
      const todayIdx = list.findIndex(x => x.createDate === today);
      let cont = 0;
      for (let i = todayIdx; i >= 0; i--) { if (list[i]?.signStatue == 3 || list[i]?.signStatue == 5) cont++; else break; }
      result.continueDays = cont;
      const signCount = Number(infoRes?.data?.signCount) || 0;
      if (signCount >= 30) {
        const blindRes = await httpGet(`https://h5.zeehoev.com/cfmotoservermine/signin/supplementPrize?supplementDate=${today}`, { ...baseHeaders, ...getSign("h5", { supplementDate: today }, '', cfg) });
        if (blindRes?.code == "10000") {
          result.blindBoxScore = Number(blindRes?.data?.integral || blindRes?.data?.integralScore || 0);
          // 盲盒日志：≥10分显示获得积分，低于10分显示距盲盒剩余天数（避免显示"盲盒获得 +0"）
          if (result.blindBoxScore >= 10) {
            result.steps.push(`盲盒获得 +${result.blindBoxScore} (${blindRes?.data?.prizesName || "积分"})`);
          } else {
            const _bd = result.continueDays === 0 ? 0 : ((result.continueDays - 1) % 30) + 1;
            const _br = 30 - _bd;
            result.steps.push(`距盲盒剩余 ${_br} 天`);
          }
        }
      } else {
        result.steps.push(`盲盒未解锁(${signCount}/30)`);
      }
    } catch(e) { result.steps.push(`盲盒异常: ${e}`); }

    // 3. 社区任务（根据配置开关）
    const comm = cfg.community || {};
    let postId = null;
    if (comm.enablePost !== false) {
      try {
        const postRes = await httpPost(`https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/commonArticle`, { ...baseHeaders, ...getSign("app", {}, '', cfg) }, { postcontent: "开心的一天" });
        if (postRes?.code == "10000") {
          postId = getPostIdFromData(postRes.data);
          result.interactScore += 1;
          result.steps.push("发帖成功 +1");
        }
      } catch(e) { result.steps.push(`发帖异常: ${e}`); }
    }
    if (!postId) {
      try {
        const listRes = await httpGet(`https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/community/mineArticleInfo?userId=${userId}&page=1&pageSize=10`, { ...baseHeaders, ...getSign("app", {}, '', cfg) });
        const rawList = Array.isArray(listRes?.data) ? listRes.data : (listRes?.data?.records || listRes?.data?.list || []);
        const list = Array.isArray(rawList) ? rawList : [];
        // mineArticleInfo 只返回本人动态，优先按 userId 命中本人，杜绝误取他人帖导致“不可删除”
        const mine = list.find(it => String(it.userId || it.createBy || it.uid || "") === String(userId));
        postId = getPostIdFromData(mine || list[0] || listRes?.data);
      } catch(e) {}
    }
    if (postId) {
      if (comm.enableLike !== false) {
        try {
          const likeRes = await httpPost(`https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/socialCommu/likeFavoriteInfo`, { ...baseHeaders, ...getSign("app", {}, '', cfg) }, { postId: String(postId), kindFlag: "0" });
          if (likeRes?.code == "10000") { result.interactScore += 1; result.steps.push("点赞成功 +1"); }
        } catch(e) { result.steps.push(`点赞异常: ${e}`); }
      }
      if (comm.enableComment !== false) {
        try {
          await httpPost(`https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/commentInfo`, { ...baseHeaders, ...getSign("app", {}, '', cfg) }, { postid: String(postId), userId: String(userId), comments: "厉害", sendTos: "[\n\n]" });
          result.steps.push("评论完成");
        } catch(e) { result.steps.push(`评论异常: ${e}`); }
      }
      if (comm.enableShare !== false) {
        try {
          const shareRes = await httpPut(`https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/article/share/${postId}`, { ...baseHeaders, ...getSign("app", {}, '', cfg) });
          if (shareRes?.code == "10000") { result.interactScore += 1; result.steps.push("分享成功 +1"); }
          await httpGet(`https://tapi.zeehoev.com/v1.0/mine/cfmotoservermine/integral/adjustByShare`, { ...baseHeaders, ...getSign("app", {}, '', cfg) });
        } catch(e) { result.steps.push(`分享异常: ${e}`); }
      }
      if (comm.enableDelete !== false && postId) {
        try {
          await httpDelete(`https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/commonArticle/deleteArticle?articleId=${postId}&postType=1`, { ...baseHeaders, ...getSign("app", {}, '', cfg) });
          result.steps.push("动态已删除");
        } catch(e) { result.steps.push(`删除异常: ${e}`); }
      }
    }

    result.totalGain = result.signinScore + result.blindBoxScore + result.interactScore;
    result.success = true;
  } catch(e) {
    result.error = String(e);
    result.steps.push(`执行异常: ${e}`);
  }
  return result;
}

// ========== 辅助：HTTP POST/PUT/DELETE ==========
function httpPost(url, headers, body, timeoutMs) {
  return new Promise((resolve) => {
    const isQX = typeof $task !== "undefined";
    const opts = { url, headers, method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) };
    // 单次请求超时：QX($task.fetch)单位为毫秒，Loon/Surge($httpClient)单位为秒，分别换算
    if (timeoutMs && timeoutMs > 0) opts.timeout = isQX ? timeoutMs : Math.max(1, Math.round(timeoutMs / 1000));
    if (isQX) {
      $task.fetch(opts).then(
        function(resp) { try { resolve(JSON.parse(resp.body)); } catch(e) { resolve({ error: "parse error", raw: resp.body }); } },
        function(err) { resolve({ error: String(err && err.error || err || "request failed") }); }
      );
    } else {
      $httpClient.post(opts, function(err, resp, body) {
        if (err) { resolve({ error: String(err) }); return; }
        try { resolve(JSON.parse(body)); } catch(e) { resolve({ error: "parse error", raw: body }); }
      });
    }
  });
}
function httpPut(url, headers, body) {
  return new Promise((resolve) => {
    const isQX = typeof $task !== "undefined";
    const opts = { url, headers, method: "PUT" };
    // 支持 PUT 携带请求体（开坐垫等接口需要）
    if (body !== undefined && body !== null) opts.body = typeof body === "string" ? body : JSON.stringify(body);
    if (isQX) {
      $task.fetch(opts).then(
        function(resp) { try { resolve(JSON.parse(resp.body)); } catch(e) { resolve({ error: "parse error", raw: resp.body }); } },
        function(err) { resolve({ error: String(err && err.error || err || "request failed") }); }
      );
    } else {
      $httpClient.put(opts, function(err, resp, body) {
        if (err) { resolve({ error: String(err) }); return; }
        try { resolve(JSON.parse(body)); } catch(e) { resolve({ error: "parse error", raw: body }); }
      });
    }
  });
}
function httpDelete(url, headers) {
  return new Promise((resolve) => {
    const isQX = typeof $task !== "undefined";
    const opts = { url, headers, method: "DELETE" };
    if (isQX) {
      $task.fetch(opts).then(
        function(resp) { try { resolve(JSON.parse(resp.body)); } catch(e) { resolve({ error: "parse error", raw: resp.body }); } },
        function(err) { resolve({ error: String(err && err.error || err || "request failed") }); }
      );
    } else {
      $httpClient.delete(opts, function(err, resp, body) {
        if (err) { resolve({ error: String(err) }); return; }
        try { resolve(JSON.parse(body)); } catch(e) { resolve({ error: "parse error", raw: body }); }
      });
    }
  });
}
function getPostIdFromData(data) {
  if (!data) return null;
  if (typeof data === "string" || typeof data === "number") return String(data);
  if (Array.isArray(data)) return getPostIdFromData(data[0]);
  const direct = data.uuid || data.tuuid || data.postId || data.postid || data.articleId || data.articleID || data.id || data.dataId || data.tid;
  if (direct) return String(direct);
  for (const key of ["records", "list", "rows", "data", "result"]) {
    const v = data[key];
    const pid = getPostIdFromData(v);
    if (pid) return pid;
  }
  return null;
}

// ========== 纯JS AES-256-ECB + PKCS7（云端开关锁需要；Loon JS环境无原生AES，已与标准库逐向量比对验证） ==========
const AES_SBOX = new Uint8Array([
0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
]);
const AES_RCON = new Uint8Array([0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36,0x6c,0xd8,0xab,0x4d]);
function aesGMul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}
// AES-256 密钥扩展（Nk=8, Nr=14，输出240字节）
function aesKeyExpansion256(key) {
  const Nk = 8, Nb = 4, Nr = 14;
  const w = new Uint8Array(4 * Nb * (Nr + 1));
  for (let i = 0; i < Nk * 4; i++) w[i] = key[i];
  for (let i = Nk; i < Nb * (Nr + 1); i++) {
    let t0 = w[4*(i-1)], t1 = w[4*(i-1)+1], t2 = w[4*(i-1)+2], t3 = w[4*(i-1)+3];
    if (i % Nk === 0) {
      const tmp = t0;
      t0 = AES_SBOX[t1] ^ AES_RCON[i/Nk];
      t1 = AES_SBOX[t2];
      t2 = AES_SBOX[t3];
      t3 = AES_SBOX[tmp];
    } else if (i % Nk === 4) {
      t0 = AES_SBOX[t0]; t1 = AES_SBOX[t1]; t2 = AES_SBOX[t2]; t3 = AES_SBOX[t3];
    }
    w[4*i]   = w[4*(i-Nk)]   ^ t0;
    w[4*i+1] = w[4*(i-Nk)+1] ^ t1;
    w[4*i+2] = w[4*(i-Nk)+2] ^ t2;
    w[4*i+3] = w[4*(i-Nk)+3] ^ t3;
  }
  return w;
}
// 加密单个16字节块
function aesEncryptBlock(input, w) {
  const Nb = 4, Nr = 14;
  const s = new Uint8Array(16);
  for (let i = 0; i < 16; i++) s[i] = input[i];
  for (let i = 0; i < 16; i++) s[i] ^= w[i];
  for (let round = 1; round <= Nr; round++) {
    for (let i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]];
    let t = s[1]; s[1]=s[5]; s[5]=s[9]; s[9]=s[13]; s[13]=t;
    t=s[2]; s[2]=s[10]; s[10]=t; t=s[6]; s[6]=s[14]; s[14]=t;
    t=s[3]; s[3]=s[15]; s[15]=s[11]; s[11]=s[7]; s[7]=t;
    if (round !== Nr) {
      for (let c = 0; c < 4; c++) {
        const i = 4*c;
        const a0=s[i],a1=s[i+1],a2=s[i+2],a3=s[i+3];
        s[i]   = aesGMul(a0,2)^aesGMul(a1,3)^a2^a3;
        s[i+1] = a0^aesGMul(a1,2)^aesGMul(a2,3)^a3;
        s[i+2] = a0^a1^aesGMul(a2,2)^aesGMul(a3,3);
        s[i+3] = aesGMul(a0,3)^a1^a2^aesGMul(a3,2);
      }
    }
    const off = round*16;
    for (let i = 0; i < 16; i++) s[i] ^= w[off+i];
  }
  return s;
}
function aesUtf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0|(c>>6), 0x80|(c&0x3f));
    else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = str.charCodeAt(++i);
      c = 0x10000 + ((c-0xd800)<<10) + (c2-0xdc00);
      out.push(0xf0|(c>>18), 0x80|((c>>12)&0x3f), 0x80|((c>>6)&0x3f), 0x80|(c&0x3f));
    } else out.push(0xe0|(c>>12), 0x80|((c>>6)&0x3f), 0x80|(c&0x3f));
  }
  return new Uint8Array(out);
}
function aesBytesToBase64(bytes) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "", i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2];
    result += chars[(n>>18)&63]+chars[(n>>12)&63]+chars[(n>>6)&63]+chars[n&63];
  }
  const rem = bytes.length - i;
  if (rem === 1) { const n = bytes[i]<<16; result += chars[(n>>18)&63]+chars[(n>>12)&63]+"=="; }
  else if (rem === 2) { const n = (bytes[i]<<16)|(bytes[i+1]<<8); result += chars[(n>>18)&63]+chars[(n>>12)&63]+chars[(n>>6)&63]+"="; }
  return result;
}
// 对外：AES-256-ECB + PKCS7，key为32字节ASCII字符串，返回Base64
function aes256EcbEncryptBase64(plaintext, keyStr) {
  const key = aesUtf8Bytes(keyStr);
  if (key.length !== 32) throw new Error("AES-256需要32字节密钥，当前" + key.length);
  const w = aesKeyExpansion256(key);
  const data = aesUtf8Bytes(plaintext);
  const padLen = 16 - (data.length % 16);
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  for (let i = data.length; i < padded.length; i++) padded[i] = padLen;
  const out = new Uint8Array(padded.length);
  for (let off = 0; off < padded.length; off += 16) {
    out.set(aesEncryptBlock(padded.slice(off, off+16), w), off);
  }
  return aesBytesToBase64(out);
}

// ========== 车辆远程控制（寻车/鸣笛闪灯/开坐垫/云端开关锁，均会真实操作车辆） ==========
// 云端开/关锁 AES-256-ECB 密钥【不再内置】：统一从配置 cfg.vehicleAesKey 读取，用户须在配置页手动填写并保存后才能开/关锁（防滥用）。
// 算法：AES-256-ECB/PKCS7（32位密钥按ASCII），明文为带空格换行JSON、lockFlag为字符串"1"/"0"，密文Base64放进 body{"secret":...}
const VEHICLE_ACTION_TEXT = { find: "短按寻车", loudFind: "鸣笛闪灯", cushion: "打开坐垫", unlock: "云端开锁", lock: "云端关锁" };
function vehicleBaseHeaders(acc, cfg) {
  // 与官方App真实请求头对齐：UA / x-app-info / Accept；user_id 同时走独立头与 Cookie（官方放在 Cookie 里）
  const ua = acc.userAgent || "MOBILE|iOS|16.1.1|ZEEHO_APP|3.0.1|iPhone|WWAN|iOS";
  const h = {
    "Authorization": `Bearer ${cleanToken(acc.token)}`,
    "Content-Type": "application/json;charset=UTF-8",
    "interfaceversion": "2",
    "Accept-Language": "zh-CN",
    "Accept": "*/*",
    "User-Agent": ua,
    "x-app-info": ua
  };
  if (acc.userId) {
    h["user_id"] = String(acc.userId);
    h["Cookie"] = `user_id=${acc.userId}`;
  }
  return h;
}
function vehicleCheckRes(res, okMsg) {
  if (res && !res.error && (res.code == "10000" || res.code === 10000)) return { ok: true, message: okMsg };
  // 控车指令经4G云端下发到车，响应常慢于客户端默认超时时长；超时时车辆往往已实际执行，按“已下发”提示，避免明明成功却弹红叉
  const errText = String((res && (res.error || res.message || res.msg)) || "").toLowerCase();
  if (res && res.error && /timeout|timed out|time out|请求超时|reuqest/.test(errText)) {
    return { ok: true, message: okMsg + "（响应超时但车辆通常已执行，可下拉刷新车辆状态确认）" };
  }
  return { ok: false, message: (res && (res.message || res.msg)) || (res && res.error) || "指令下发失败", code: res && res.code };
}
async function vehicleControl(acc, action, cfg, customVin) {
  try {
    const c = cfg || getConfig();
    // 1) 取 VIN：优先使用传入的 customVin（切换车辆后前端传过来的），其次账号已保存，否则实时查车辆列表取第一台
    let vin = customVin || acc.vinNo || "";
    if (!vin) {
      const list = await fetchVehicleList(acc, c);
      if (!list || !list.length) return { ok: false, message: "未获取到绑定车辆(VIN)，请确认账号已绑定车辆" };
      vin = list[0].vinNo;
    }
    const base = vehicleBaseHeaders(acc, c);

    // 2026-09-20 新增：控车请求失败自动重试一次（切换车辆后偶尔 HTTPClient request failed 是网络瞬时问题）
    const retry = async (fn, okMsg) => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const res = await fn();
        const check = vehicleCheckRes(res, okMsg);
        if (check.ok) return check;
        // 网络错误才重试，业务错误（如未配置密钥）不重试
        const isNetErr = res && res.error && /HTTPClient request failed|timeout|timed out|ETIMEDOUT|ECONNRESET|网络/.test(String(res.error));
        if (!isNetErr || attempt >= 2) return check;
        await new Promise(r => setTimeout(r, 1200));
      }
    };

    // 2) 按动作下发
    if (action === "find") {
      // 短按寻车：PUT control/{vin}，空body
      const h = { ...base, ...getSign("app", {}, "", c) };
      return await retry(() => httpPut(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicleInfo/control/${vin}`, h), "寻车指令已下发，车辆应闪灯提示");
    }
    if (action === "loudFind") {
      // 高声寻车（鸣笛+闪灯）：POST controlV2，body {"param":"4","vin":vin}
      const bodyStr = JSON.stringify({ param: "4", vin: vin });
      const h = { ...base, ...getSign("app", {}, bodyStr, c) };
      return await retry(() => httpPost(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicleInfo/controlV2`, h, bodyStr), "鸣笛闪灯指令已下发");
    }
    if (action === "cushion") {
      // 开坐垫：PUT propertyTwo/one，commond=28
      const bodyStr = JSON.stringify({ commond: "28", commondParam: "1", vcu: vin, version: "v2" });
      const h = { ...base, ...getSign("app", {}, bodyStr, c) };
      return await retry(() => httpPut(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicleSet/propertyTwo/one`, h, bodyStr), "开坐垫指令已下发，坐垫应弹起");
    }
    if (action === "unlock" || action === "lock") {
      // 云端开关锁(App 3.0.1)：POST vehicleSet/network/unlock，lockFlag "1"=开锁 / "0"=关锁（同一接口靠 lockFlag 区分，值为字符串而非数字）。
      // 密钥来自配置页 cfg.vehicleAesKey（默认不内置，必须先填写保存，防止脚本被滥用）。
      const vKey = (c.vehicleAesKey || "").trim();
      if (!vKey) return { ok: false, message: "尚未配置云端控车密钥：请到「配置 → 签名密钥配置」填写云端控车AES密钥并保存后，再使用开/关锁" };
      if (!/^[0-9a-fA-F]{32}$/.test(vKey)) return { ok: false, message: "云端控车密钥格式错误（应为32位十六进制），请到配置页核对后保存" };
      // 明文必须与官方 NSJSONSerialization 输出逐字节一致（冒号后带空格、键值间为 ",\n  "）：
      // {\n  "lockFlag" : "1",\n  "vinNo" : "VIN"\n} → AES-256-ECB/PKCS7(密钥32字节ASCII) → Base64；
      // 实际发送 body={"secret":Base64密文}；注意【签名签的是明文 plain，不是 secret】（密钥/明文格式已用4条官方真实密文逐字节复现验证）。
      const lockFlag = action === "unlock" ? "1" : "0";
      const plain = `{\n  "lockFlag" : "${lockFlag}",\n  "vinNo" : "${vin}"\n}`;
      const secret = aes256EcbEncryptBase64(plain, vKey);
      const sendBody = JSON.stringify({ secret: secret });
      const h = { ...base, ...getSign("app", {}, plain, c) };
      console.log(`[车辆控制] ${action} 明文=${JSON.stringify(plain)} secret=${secret.slice(0,24)}...`);
      // 车辆唤醒+云端下发较慢，给25秒单次超时，避免在默认超时时长内误报（即便最终仍超时也会按“已下发”容错）
      const res = await httpPost(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicleSet/network/unlock`, h, sendBody, 25000);
      try { console.log(`[车辆控制] ${action} 服务器返回=${JSON.stringify(res).slice(0,300)}`); } catch(e) {}
      return vehicleCheckRes(res, action === "unlock" ? "云端开锁指令已下发" : "云端关锁指令已下发");
    }
    return { ok: false, message: "未知操作类型: " + action };
  } catch(e) {
    return { ok: false, message: "控制异常: " + String(e) };
  }
}


// ========== 车辆信息获取 ==========
async function fetchServiceRechargeDetail(acc, cfg, vinNo) {
  try {
    const token = cleanToken(acc.token);
    const signH = getSign("h5", { vinNo: vinNo }, '', cfg);
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
      "interfaceversion": "2",
      ...signH
    };
    if (acc.userId) headers["user_id"] = String(acc.userId);
    const res = await httpGet(`https://h5.zeehoev.com/cfmotoserverapp/app/service/recharge/vehicle/detail?vinNo=${encodeURIComponent(vinNo)}`, headers);
    if (res.code == "10000" && res.data) {
      return {
        rechargeEndDate: String(res.data.rechargeEndDate || ""),
        lastUseDate: Number(res.data.lastUseDate) || 0,
        serviceRechargeStatus: String(res.data.serviceRechargeStatus || ""),
        vehicleName: String(res.data.vehicleName || "")
      };
    }
    return null;
  } catch(e) { return null; }
}

async function fetchVehicleList(acc, cfg) {
  try {
    const token = cleanToken(acc.token);
    const signH = getSign("app", {}, '', cfg);
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
      "interfaceversion": "2",
      ...signH
    };
    if (acc.userId) headers["user_id"] = String(acc.userId);
    const res = await httpGet("https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicle/list", headers);
    // 兼容多种响应格式：data 可能是数组，也可能是 { list: [...] } 或 { records: [...] }
    let list = [];
    if (res.code == "10000" || res.code === 10000) {
      if (Array.isArray(res.data)) list = res.data;
      else if (res.data && Array.isArray(res.data.list)) list = res.data.list;
      else if (res.data && Array.isArray(res.data.records)) list = res.data.records;
      else if (res.data && Array.isArray(res.data.rows)) list = res.data.rows;
    }
    return list.map(v => ({
      vinNo: String(v.vinNo || v.frameNo || v.vin || "").trim(),
      name: String(v.vehicleName || v.vehicleType || v.deviceName || v.name || "车辆").trim() || "车辆",
      pic: String(v.vehiclePicUrl || v.pic || v.imageUrl || "").trim(),
      vehicleType: String(v.vehicleType || v.type || "").trim(),
      licensePlate: v.licensePlate || null
    })).filter(v => v.vinNo);
  } catch(e) { return []; }
}

async function fetchVehicleWidgets(acc, cfg, vinNo) {
  try {
    const token = cleanToken(acc.token);
    const signH = getSign("app", {}, '', cfg);
    const res = await httpGet(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicle/widgets/${encodeURIComponent(vinNo)}`, {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
      "interfaceversion": "2",
      "user_id": acc.userId || "",
      ...signH
    });
    if ((res.code == "10000" || res.code === 10000) && res.data) {
      const d = res.data;
      const soc = Number(d.bmssoc || d.batteryLevel || 0);
      const range = Number(d.hmiRidableMile || d.vehicleRidableMile || d.ridableMileage || 0);
      const voltage = Number(d.voltage || d.batteryVoltage || d.bmsVoltage || d.totalVoltage || d.batteryTotalVoltage || 0);
      // GPS 经纬度：V2结构层级不固定，用 deepPick 在整棵树兜底找常见字段名；经度 lng/lon、纬度 lat
      const lngStr = deepPick(d, ["longitude","lng","lon","gpsX","longitudeValue","coordX","x"]);
      const latStr = deepPick(d, ["latitude","lat","gpsY","latitudeValue","coordY","y"]);
      const longitude = Number(lngStr);
      const latitude = Number(latStr);
      return {
        batteryPercent: Math.max(0, Math.min(100, isFinite(soc) ? soc : 0)),
        residualRangeKm: isFinite(range) ? range : 0,
        voltage: isFinite(voltage) && voltage > 0 ? voltage : 0,
        address: String(d.address || "").trim(),
        locationTime: String(d.location?.locationTime || "").trim(),
        vehicleName: String(d.vehicleName || "").trim(),
        vehicleImageUrl: String(d.vehicleScalePicUrl || d.vehiclePicUrl || "").trim(),
        headLockState: String(d.headLockState || "").trim(),
        batteryPullOut: String(d.batteryPullOutFlag || "") === "1",
        // 在线状态（4G/TBOX 是否在线）：尝试常见字段名
        online: String(d.onlineStatus || d.online || d.netStatus || d.tboxStatus || d.deviceOnline || "").trim(),
        // 坐垫/座桶锁状态：字段名各版本不一致，deepPick 兜底；取不到为空串，前端不显示，绝不编造
        cushionState: deepPick(d, ["cushionState","cushionStatus","cushionLockState","seatState","seatStatus","seatLockState","saddleState","saddleStatus","saddleLockState"]),
        // GPS 坐标（数值非法时置空，前端据此置灰地图按钮）
        longitude: (isFinite(longitude) && Math.abs(longitude) <= 180 && longitude !== 0) ? longitude : "",
        latitude: (isFinite(latitude) && Math.abs(latitude) <= 90 && latitude !== 0) ? latitude : "",
        // 电源/ACC状态（开关机）：尝试多种可能字段名
        powerStatus: String(d.accStatus || d.powerStatus || d.vehicleStatus || d.ignitionStatus || d.powerMode || d.accState || d.powerState || d.vehicleState || d.engineStatus || d.isPowerOn || d.powerOn || "").trim(),
        // 车锁状态：开锁=上电(开机)，锁车=下电(关机)；headLockState龙头锁为实时字段，优先取
        lockState: String(d.headLockState || d.lockState || d.lockStatus || d.vehicleLockState || d.carLockState || d.doorLockState || d.lockFlag || d.isLocked || d.locked || d.centralLockingStatus || "").trim()
      };
    }
    return null;
  } catch(e) { return null; }
}

// 基于账号生成稳定的16位hex设备标识（uniqueIdentify/phoneDeviceName 参数用，服务端仅埋点不校验）
function getDeviceIdentify(acc) {
  const seed = String(acc.userId || acc.vinNo || "zeeho-device");
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h + seed.charCodeAt(i)) | 0; }
  return (Math.abs(h).toString(16) + "0000000000000000").slice(0, 16);
}
// 深度优先在嵌套对象里找第一个匹配 keys 的非空值（V2返回结构层级不确定）
function deepPick(obj, keys, depth) {
  if (!obj || typeof obj !== "object" || (depth || 0) > 5) return "";
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return String(obj[k]);
  }
  for (const k in obj) {
    if (obj[k] && typeof obj[k] === "object") {
      const r = deepPick(obj[k], keys, (depth || 0) + 1);
      if (r) return r;
    }
  }
  return "";
}
// 从 iotProperties 数组里按 identify 提取上报值（如 VehicleLock_S 整车锁定状态、HeadLockState 龙头锁）
function pickIotProp(d, identify) {
  const arr = d && d.iotProperties;
  if (Array.isArray(arr)) {
    const key = String(identify).toLowerCase();
    for (const it of arr) {
      if (it && String(it.identify || "").toLowerCase() === key && it.value !== null && it.value !== undefined && it.value !== "") {
        return String(it.value);
      }
    }
  }
  return "";
}
// 车辆首页综合数据 vehicleHomePageV2（极核App 3.x首页接口，GET，VIN在路径，含开关机/ACC/车锁/在线状态）
async function fetchVehicleHomePage(acc, cfg, vinNo) {
  try {
    const token = cleanToken(acc.token);
    const signH = getSign("app", {}, '', cfg);
    const deviceId = getDeviceIdentify(acc);
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
      "interfaceversion": "2",
      "user_id": acc.userId || "",
      ...signH
    };
    const url = `https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicleHomePageV2/${encodeURIComponent(vinNo)}?uniqueIdentify=${deviceId}&phoneDeviceName=ios_${deviceId}`;
    const res = await httpGet(url, headers);
    if (res && (res.code == "10000" || res.code === 10000) && res.data) {
      const d = res.data;
      // 整车锁定状态 VehicleLock_S：0=未锁(解锁即上电=开机)，1=锁定(锁车即下电=关机)；其次用顶层龙头锁 headLockState
      const vehicleLock = pickIotProp(d, "VehicleLock_S");
      const headLockIot = pickIotProp(d, "HeadLockState");
      // 顶层 headLockState 实时更新优先，其次iot龙头锁，最后整车锁VehicleLock_S(可能上报陈旧)
      const topLock = String(d.headLockState || d.lockState || d.lockStatus || d.vehicleLockState || headLockIot || vehicleLock || "").trim();
      const lngStr = deepPick(d, ["longitude","lng","lon","gpsX","longitudeValue","coordX","x"]);
      const latStr = deepPick(d, ["latitude","lat","gpsY","latitudeValue","coordY","y"]);
      const longitude = Number(lngStr);
      const latitude = Number(latStr);
      return {
        powerStatus: deepPick(d, ["accStatus","powerStatus","vehicleStatus","ignitionStatus","powerMode","accState","powerState","vehicleState","engineStatus","isPowerOn","powerOn","acc"]).trim(),
        lockState: topLock,
        online: String(d.onlineStatus || d.rideState || d.online || d.netStatus || d.tboxStatus || "").trim(),
        rideState: String(d.rideState || "").trim(),
        cushionState: deepPick(d, ["cushionState","cushionStatus","cushionLockState","seatState","seatStatus","seatLockState","saddleState","saddleStatus","saddleLockState"]),
        longitude: (isFinite(longitude) && Math.abs(longitude) <= 180 && longitude !== 0) ? longitude : "",
        latitude: (isFinite(latitude) && Math.abs(latitude) <= 90 && latitude !== 0) ? latitude : ""
      };
    }
    return null;
  } catch(e) { return null; }
}

async function fetchTirePressure(acc, cfg, vinNo) {
  try {
    const token = cleanToken(acc.token);
    const signH = getSign("app", {}, '', cfg);
    const res = await httpGet(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/app/vehicle/tire/monitoring?vinNo=${encodeURIComponent(vinNo)}&timePeriodType=1`, {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
      "interfaceversion": "2",
      "user_id": acc.userId || "",
      ...signH
    });
    if ((res.code == "10000" || res.code === 10000) && res.data) {
      const list = Array.isArray(res.data.realTimeData) ? res.data.realTimeData : (Array.isArray(res.data) ? res.data : []);
      const byPos = {};
      for (const it of list) {
        const pos = Number(it?.sensorPosition);
        if (pos) byPos[pos] = it;
      }
      const fmt = (it) => {
        const warn = Number(it?.warningType ?? 0);
        const v = String(it?.tirePressure ?? "").trim();
        const n = parseFloat(v);
        if (warn !== 0 || !v || !isFinite(n) || n <= 0) return "未绑定";
        return v + "bar";
      };
      const fmtTemp = (it) => {
        const warn = Number(it?.warningType ?? 0);
        const v = it?.tireTemp;
        if (warn !== 0 || v == null) return "";
        const s = String(v).trim();
        const n = parseFloat(s);
        if (!s || s.toLowerCase() === "null" || !isFinite(n) || n <= 0) return "";
        return s + "°C";
      };
      const front = byPos[1] || list[0];
      const rear = byPos[2] || list[1];
      return {
        frontPressure: front ? fmt(front) : "未绑定",
        rearPressure: rear ? fmt(rear) : "未绑定",
        frontTemp: front ? fmtTemp(front) : "",
        rearTemp: rear ? fmtTemp(rear) : ""
      };
    }
    return null;
  } catch(e) { return null; }
}

async function fetchRideInfo(acc, cfg, vinNo) {
  try {
    const token = cleanToken(acc.token);
    const signH = getSign("app", {}, '', cfg);
    const month = new Date().getFullYear() + "." + String(new Date().getMonth()+1).padStart(2,"0");
    const [homeRes, myRes] = await Promise.all([
      httpGet(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/homeRideInfo?vinNo=${encodeURIComponent(vinNo)}`, {
        "Authorization": `Bearer ${token}`, "Content-Type": "application/json;charset=UTF-8", "interfaceversion": "2", "user_id": acc.userId || "", ...signH
      }),
      httpGet(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/myRideInfo?vinNo=${encodeURIComponent(vinNo)}&month=${month}`, {
        "Authorization": `Bearer ${token}`, "Content-Type": "application/json;charset=UTF-8", "interfaceversion": "2", "user_id": acc.userId || "", ...signH
      })
    ]);
    const h = homeRes?.data || homeRes || {};
    const d = myRes?.data || myRes || {};
    const list = Array.isArray(d.rideRecordList) ? d.rideRecordList : [];
    const todayKey = new Date().getFullYear() + "." + String(new Date().getMonth()+1).padStart(2,"0") + "." + String(new Date().getDate()).padStart(2,"0");
    const day = list.find(x => String(x?.date || "") === todayKey) || list[list.length - 1] || {};
    return {
      todayDistance: Number(day.rideMileage ?? h.rideMileageDay ?? 0),
      todayDuration: Number(day.ridingTimeDayUnitMinute ?? h.lastRidingTimeUnitMinute ?? 0),
      todayMaxSpeed: Number(day.maxSpeed ?? 0),
      lastRideMileage: Number(h.lastRideMileage ?? 0),
      lastRideDuration: Number(h.lastRidingTimeUnitMinute ?? 0)
    };
  } catch(e) { return null; }
}

async function fetchBatteryChargeState(acc, cfg, vinNo) {
  try {
    const token = cleanToken(acc.token);
    const signH = getSign("app", {}, '', cfg);
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
      "interfaceversion": "2",
      "appid": cfg.app.appId,
      "user_id": acc.userId || "",
      ...signH
    };
    const res = await httpGet(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/batteryInfo/${encodeURIComponent(vinNo)}`, headers);
    if (res.code == "10000" && res.data) {
      const d = res.data;
      // 尝试提取电压（多种可能字段名）
      const voltage = Number(d.voltage || d.batteryVoltage || d.bmsVoltage || d.totalVoltage || d.batteryTotalVoltage || d.vol || d.batVoltage || d.batteryVol || 0);
      // 尝试提取电流
      const current = Number(d.current || d.batteryCurrent || d.bmsCurrent || d.cur || d.batteryCur || 0);
      // 尝试提取电池温度
      const batteryTemp = Number(d.batteryTemp || d.batTemp || d.temp || d.temperature || d.bmsTemp || d.batteryTemperature || 0);
      const range = Number(d.hmiRidableMile || d.vehicleRidableMile || d.ridableMileage || d.residualRange || 0);
      return {
        chargeState: String(d.chargeStateStr || d.chargeState || "未充电"),
        voltage: isFinite(voltage) && voltage > 0 ? voltage : 0,
        current: isFinite(current) ? current : 0,
        batteryTemp: isFinite(batteryTemp) ? batteryTemp : 0,
        soc: Number(d.soc || d.batteryLevel || d.bmssoc || 0),
        residualRangeKm: isFinite(range) ? range : 0
      };
    }
    return { chargeState: "未充电", voltage: 0, current: 0, batteryTemp: 0, soc: 0, residualRangeKm: 0 };
  } catch(e) { return { chargeState: "未充电", voltage: 0, current: 0, batteryTemp: 0, soc: 0, residualRangeKm: 0 }; }
}

async function fetchVehicleInfo(acc, cfg, vinNo) {
  const result = { hasVehicle: false, vehicleName: "", vinNo: "", voltage: 0, current: 0, batteryTemp: 0, batteryPercent: 0, residualRangeKm: 0, rangeEstimated: false, address: "", locationTime: "", chargeState: "未充电", frontPressure: "", rearPressure: "", frontTemp: "", rearTemp: "", todayDistance: 0, todayDuration: 0, todayMaxSpeed: 0, lastRideMileage: 0, vehicleImageUrl: "", serviceEndDate: "", serviceRemainDays: 0, serviceStatus: "", powerStatus: "", lockState: "", online: "", rideState: "", cushionState: "", longitude: "", latitude: "" };
  try {
    const vehicles = await fetchVehicleList(acc, cfg);
    if (vehicles.length === 0) return result;
    const v = vinNo ? (vehicles.find(x => x.vinNo === vinNo) || vehicles[0]) : vehicles[0];
    result.vehicles = vehicles.map(x => ({ name: x.name, vinNo: x.vinNo }));
    result.currentVin = v.vinNo;
    result.hasVehicle = true;
    result.vehicleName = v.name;
    result.vinNo = v.vinNo;
    result.vehicleImageUrl = v.pic;
    const [widgets, tire, ride, battery, service, homePage] = await Promise.all([
      fetchVehicleWidgets(acc, cfg, v.vinNo).catch(() => null),
      fetchTirePressure(acc, cfg, v.vinNo).catch(() => null),
      fetchRideInfo(acc, cfg, v.vinNo).catch(() => null),
      fetchBatteryChargeState(acc, cfg, v.vinNo).catch(() => ({ chargeState: "未充电", voltage: 0, current: 0, batteryTemp: 0, soc: 0 })),
      fetchServiceRechargeDetail(acc, cfg, v.vinNo).catch(() => null),
      fetchVehicleHomePage(acc, cfg, v.vinNo).catch(() => null)
    ]);
    if (widgets) {
      result.batteryPercent = widgets.batteryPercent;
      result.residualRangeKm = widgets.residualRangeKm;
      result.voltage = widgets.voltage;
      result.address = widgets.address;
      result.locationTime = widgets.locationTime;
      result.powerStatus = widgets.powerStatus || "";
      result.lockState = widgets.lockState || "";
      if (widgets.vehicleName) result.vehicleName = widgets.vehicleName;
      if (widgets.vehicleImageUrl) result.vehicleImageUrl = widgets.vehicleImageUrl;
      if (widgets.online) result.online = widgets.online;
      if (widgets.cushionState) result.cushionState = widgets.cushionState;
      // 坐标：widgets 先取到就用
      if (widgets.longitude !== "" && widgets.longitude !== undefined) result.longitude = widgets.longitude;
      if (widgets.latitude !== "" && widgets.latitude !== undefined) result.latitude = widgets.latitude;
    }
    // homePage 优先（可能包含更准确的开关机/车锁状态）
    if (homePage) {
      if (homePage.powerStatus) result.powerStatus = homePage.powerStatus;
      if (homePage.lockState) result.lockState = homePage.lockState;
      if (homePage.online) result.online = homePage.online;
      if (homePage.rideState) result.rideState = homePage.rideState;
      if (homePage.cushionState) result.cushionState = homePage.cushionState;
      // 坐标兜底：widgets 没取到时用首页综合接口的
      if ((result.longitude === "" || result.longitude === undefined) && homePage.longitude !== "" && homePage.longitude !== undefined) result.longitude = homePage.longitude;
      if ((result.latitude === "" || result.latitude === undefined) && homePage.latitude !== "" && homePage.latitude !== undefined) result.latitude = homePage.latitude;
    }
    if (tire) {
      result.frontPressure = tire.frontPressure;
      result.rearPressure = tire.rearPressure;
      result.frontTemp = tire.frontTemp;
      result.rearTemp = tire.rearTemp;
    }
    if (ride) {
      result.todayDistance = ride.todayDistance;
      result.todayDuration = ride.todayDuration;
      result.todayMaxSpeed = ride.todayMaxSpeed;
      result.lastRideMileage = ride.lastRideMileage;
    }
    result.chargeState = battery.chargeState || "未充电";
    if (battery.voltage) result.voltage = battery.voltage;
    if (battery.current) result.current = battery.current;
    if (battery.batteryTemp) result.batteryTemp = battery.batteryTemp;
    // 续航兜底：充电时 widgets/batteryInfo 都可能返回0，先尝试 batteryInfo，再基于电量估算
    if ((!result.residualRangeKm || result.residualRangeKm === 0) && battery.residualRangeKm) {
      result.residualRangeKm = battery.residualRangeKm;
    }
    if ((!result.residualRangeKm || result.residualRangeKm === 0) && result.batteryPercent > 0) {
      // 基于电量百分比估算续航（满电按87km估算，极核AE4系列常见值）
      result.residualRangeKm = Math.round(result.batteryPercent * 0.87);
      result.rangeEstimated = true;
    }
    if (service) {
      result.serviceEndDate = service.rechargeEndDate || "";
      result.serviceStatus = service.serviceRechargeStatus || "";
      result.serviceRemainDays = service.lastUseDate || 0;
      if (service.vehicleName) result.vehicleName = service.vehicleName;
    }
  } catch(e) {}
  return result;
}

// ========== 获取单账号实时数据 ==========
async function fetchAccountData(acc, cfg, vinNo) {
  const token = cleanToken(acc.token);
  let userId = acc.userId || "";
  const month = new Date().getFullYear() + "-" + (new Date().getMonth() + 1);
  const now = new Date();
  const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");

  const result = {
    userName: acc.userName || "未知用户",
    userId: userId,
    score: 0,
    signedToday: false,
    continueDays: 0,
    todayScore: 0,
    signCount: 0,
    last7: [],
    error: null,
    vehicle: { hasVehicle: false }
  };

  // userId 为空时，尝试自动获取（兜底，主要靠配置页手动输入）
  if (!userId) {
    try {
      const signH = getSign("app", {}, '', cfg);
      // 尝试从 vehicle/list 响应中提取 userId
      const vehicleRes = await httpGet("https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicle/list", {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json;charset=UTF-8",
        "interfaceversion": "2",
        ...signH
      });
      if (vehicleRes.code == "10000" && vehicleRes.data) {
        const autoUid = String(vehicleRes.data.userId || vehicleRes.data.uid || vehicleRes.data.id || "");
        if (autoUid) {
          userId = autoUid;
          result.userId = userId;
          // 自动保存获取到的 userId
          try {
            const accounts = getAccounts();
            const idx = accounts.findIndex(a => cleanToken(a.token) === token);
            if (idx >= 0 && !accounts[idx].userId) {
              accounts[idx].userId = userId;
              saveAccounts(accounts);
            }
          } catch(e) {}
        }
      }
    } catch(e) {}
  }

  // 0. 车辆信息（独立获取，不影响其他功能）
  try {
    result.vehicle = await fetchVehicleInfo(acc, cfg, vinNo);
  } catch(e) { result.vehicle = { hasVehicle: false }; }

  // 1. 积分
  try {
    if (!userId) {
      result.error = "请在配置页填写用户ID";
    } else {
      const signH = getSign("app", {}, '', cfg);
      const infoUrl = `https://tapi.zeehoev.com/v1.0/mine/cfmotoservermine/setting/${userId}`;
      const infoRes = await httpGet(infoUrl, {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json;charset=UTF-8",
        "interfaceversion": "2",
        "user_id": userId,
        ...signH
      });
      if (infoRes.code == "10000" && infoRes.data) {
        // 尝试多种积分字段名
        result.score = Number(infoRes.data.score || infoRes.data.integral || infoRes.data.point || infoRes.data.points || infoRes.data.totalScore || infoRes.data.totalIntegral || 0);
        // 昵称始终用配置中保存的，不用API返回的nickName覆盖
      } else if (infoRes.code == "40001" || infoRes.code == 401) {
        result.error = "Token已过期";
      } else {
        result.error = "积分获取失败: " + (infoRes.message || infoRes.code || "未知错误");
      }
    }
  } catch(e) { result.error = "积分获取异常: " + String(e); }

  // 2. 签到状态（跨月：并行请求当月+上月，合并计算连签，避免1号重置）
  try {
    const now = new Date();
    const curMonth = now.getFullYear() + "-" + (now.getMonth() + 1);
    const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastDate.getFullYear() + "-" + (lastDate.getMonth() + 1);
    const baseHeaders = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
      "interfaceversion": "2",
      "user_id": userId
    };
    const [curRes, lastRes] = await Promise.all([
      httpGet(`https://h5.zeehoev.com/cfmotoservermine/signin/info?month=${curMonth}`, { ...baseHeaders, ...getSign("h5", { month: curMonth }, '', cfg) }),
      httpGet(`https://h5.zeehoev.com/cfmotoservermine/signin/info?month=${lastMonth}`, { ...baseHeaders, ...getSign("h5", { month: lastMonth }, '', cfg) })
    ]);
    const lastList = (lastRes.code == "10000" && lastRes.data) ? (lastRes.data.nowSignDetailVos || []) : [];
    const curList = (curRes.code == "10000" && curRes.data) ? (curRes.data.nowSignDetailVos || []) : [];
    const list = [...lastList, ...curList];
    if (curRes.code == "10000" && curRes.data) {
      result.signCount = Number(curRes.data.signCount) || 0;
    }
    const todayEntry = curList.find(x => x.createDate === today);
    result.signedToday = !!(todayEntry && (todayEntry.signStatue == 3 || todayEntry.signStatue == 5));
    result.todayScore = todayEntry ? (Number(todayEntry.integralScore) || 0) : 0;
    // 优先用今日签到运行日志里的准确总得分（签到+盲盒+互动），没有运行记录则回退到签到分
    try {
      const _todayLogs = (getLogs() || []).filter(l => l && l.date === today && String(l.userId || "") === String(userId) && l.success);
      if (_todayLogs.length > 0) {
        const _tl = _todayLogs[0];
        result.todayScore = Number(_tl.totalGain) || result.todayScore;
        result.todayDetail = {
          signinScore: Number(_tl.signinScore) || 0,
          blindBoxScore: Number(_tl.blindBoxScore) || 0,
          interactScore: Number(_tl.interactScore) || 0
        };
      }
    } catch(e) {}
    // 跨月连签：从今天往前数，遇到断签停止（不按月重置）
    const todayIdx = list.findIndex(x => x.createDate === today);
    let cont = 0;
    if (todayIdx >= 0) {
      for (let i = todayIdx; i >= 0; i--) {
        const st = list[i]?.signStatue;
        if (st == 3 || st == 5) cont++; else break;
      }
    }
    result.continueDays = cont;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const entry = list.find(x => x.createDate === ds);
      result.last7.push({
        date: ds.slice(5),
        signed: !!(entry && (entry.signStatue == 3 || entry.signStatue == 5)),
        isToday: i === 0
      });
    }
  } catch(e) { if (!result.error) result.error = "签到状态获取失败"; }

  // Token 状态检测
  try {
    const tokenCheck = await checkToken(acc, cfg);
    result.tokenValid = tokenCheck.valid;
    result.tokenReason = tokenCheck.reason || null;
    // 昵称优先使用配置中保存的，配置为空时才用token检测返回的
    if (tokenCheck.valid && tokenCheck.userName && (!result.userName || result.userName === "未知用户")) result.userName = tokenCheck.userName;
  } catch(e) { result.tokenValid = true; }
  return result;
}

// ========== 并发拉取全部账号数据 ==========
// 默认并发3路，兼顾看板流畅度与极核服务端限流风险；返回顺序与账号列表一致
async function fetchAllAccounts(accounts, cfg, limit = 3) {
  const out = new Array(accounts.length);
  let i = 0;
  async function worker() {
    while (i < accounts.length) {
      const idx = i++;
      try {
        out[idx] = await fetchAccountData(accounts[idx], cfg);
      } catch(e) {
        out[idx] = { userName: accounts[idx].userName || "未知", userId: accounts[idx].userId, success: false, error: String(e) };
      }
    }
  }
  const n = Math.max(1, Math.min(limit, accounts.length));
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

// ========== 解析请求 body ==========
function parseBody(req) {
  try {
    if (!req.body) return {};
    if (typeof req.body === "object") return req.body;
    return JSON.parse(req.body);
  } catch(e) { return {}; }
}


// ========== HTML: 看板页 ==========
// 根据电源状态/车锁状态判断开关机显示（优先电源字段，其次用车锁推断：开锁=上电/开机，锁车=下电/关机）
function getPowerDisplay(powerStatus, lockState) {
  const p = String(powerStatus || "").toLowerCase().trim();
  const l = String(lockState || "").toLowerCase().trim();
  const onVals = ["1", "on", "true", "开机", "open", "激活", "acc_on", "acc on", "power_on", "power on", "已开机", "已上电"];
  const offVals = ["0", "off", "false", "关机", "closed", "待机", "acc_off", "acc off", "power_off", "power off", "已关机", "已下电"];
  if (p) {
    if (onVals.includes(p)) return { text: "已开机", cls: "power-on" };
    if (offVals.includes(p)) return { text: "已关机", cls: "power-off" };
  }
  if (l) {
    const lockOnVals = ["0", "未锁", "开锁", "unlocked", "false", "open", "已开锁", "未锁车"];
    const lockOffVals = ["1", "已锁", "锁车", "locked", "true", "closed", "已锁车"];
    if (lockOnVals.includes(l)) return { text: "已开机", cls: "power-on" };
    if (lockOffVals.includes(l)) return { text: "已关机", cls: "power-off" };
  }
  return { text: "状态未知", cls: "power-unknown" };
}

// 在线状态（4G/TBOX）：1/online/true/在线=在线，0/offline/false/离线=离线，取不到返回空串不显示
function getOnlineDisplay(online) {
  const s = String(online || "").toLowerCase().trim();
  if (!s) return { text: "", cls: "" };
  const onVals = ["1", "on", "online", "true", "在线", "已在线", "connected", "normal"];
  const offVals = ["0", "off", "offline", "false", "离线", "未在线", "已离线", "disconnect", "disconnected", "sleep", "休眠"];
  if (onVals.includes(s)) return { text: "在线", cls: "online-on" };
  if (offVals.includes(s)) return { text: "离线", cls: "online-off" };
  // 其它非标准值原样展示（如 rideState 文本），用中性色
  return { text: String(online), cls: "online-unk" };
}
// 车锁状态：返回 {text,cls}，取不到返回空串
function getLockDisplay(lockState) {
  const s = String(lockState || "").toLowerCase().trim();
  if (!s) return { text: "", cls: "" };
  const unlocked = ["0", "未锁", "开锁", "unlocked", "false", "open", "已开锁", "未锁车"];
  const locked = ["1", "已锁", "锁车", "locked", "true", "closed", "已锁车"];
  if (unlocked.includes(s)) return { text: "未锁车", cls: "lock-unlocked" };
  if (locked.includes(s)) return { text: "已锁车", cls: "lock-locked" };
  return { text: String(lockState), cls: "lock-unk" };
}
// 坐垫状态：字段语义不确定，仅在有值时原样展示，不做开/合的武断映射
function getCushionDisplay(cushionState) {
  const s = String(cushionState || "").trim();
  if (!s) return "";
  const openVals = ["1", "open", "opened", "on", "true", "开", "已开", "打开", "弹开"];
  const closedVals = ["0", "close", "closed", "off", "false", "关", "已关", "闭合", "关闭"];
  if (openVals.includes(s.toLowerCase())) return "坐垫已开";
  if (closedVals.includes(s.toLowerCase())) return "坐垫已合";
  return "坐垫·" + s;
}
// 坐标是否有效（经纬度都是非空有限数、在合法区间、且不是 0,0）
function hasValidCoord(lat, lng) {
  if (lat === "" || lat === null || lat === undefined || lng === "" || lng === null || lng === undefined) return false;
  const la = Number(lat), ln = Number(lng);
  return isFinite(la) && isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180 && !(la === 0 && ln === 0);
}

function renderDashboard(accounts, data, cfg, updateTime) {
  const totalScore = data.reduce((s, a) => s + (a.score || 0), 0);
  const signedCount = data.filter(a => a.signedToday).length;

  const cards = data.map((a, idx) => {
    // 盲盒30天一轮，满30第二天重置为第1天
    const blindDay = a.continueDays === 0 ? 0 : ((a.continueDays - 1) % 30) + 1;
    const blindRound = a.continueDays === 0 ? 0 : Math.ceil(a.continueDays / 30);
    const blindPct = Math.round((blindDay / 30) * 100);
    const blindRemain = 30 - blindDay;
    const last7 = a.last7.map(d => `
      <div class="day-cell ${d.signed ? 'day-ok' : 'day-miss'} ${d.isToday ? 'day-today' : ''}" title="${d.date}">
        <span class="day-num">${d.date.slice(3)}</span>
        <span class="day-mark">${d.signed ? '✓' : '—'}</span>
      </div>`).join('');

    // 充电状态判断和预计充满时间
    const v = a.vehicle || {};
    const isCharging = v.chargeState && v.chargeState !== "未充电";
    let chargeEta = "";
    if (isCharging && v.voltage && v.current && v.current > 0 && v.batteryPercent < 100) {
      const batteryCap = 1440; // 估算72V20Ah
      const remainWh = (100 - v.batteryPercent) / 100 * batteryCap;
      const powerW = v.voltage * v.current;
      const hours = remainWh / powerW;
      if (hours >= 1) chargeEta = "约" + hours.toFixed(1) + "小时充满";
      else chargeEta = "约" + Math.round(hours * 60) + "分钟充满";
    }
    // 开关机状态（优先电源字段，其次用车锁推断）
    const powerDisplay = getPowerDisplay(v.powerStatus, v.lockState);
    // 实时状态：在线 / 车锁 / 坐垫（取不到则对应为空，不渲染）
    const onlineDisplay = getOnlineDisplay(v.online || v.rideState);
    const lockDisplay = getLockDisplay(v.lockState);
    const cushionText = getCushionDisplay(v.cushionState);
    const coordOk = hasValidCoord(v.latitude, v.longitude);

    return `
    <div class="acc-card ${a.error ? 'acc-error' : ''}">
      <div class="acc-head">
        <div class="acc-avatar">${(a.userName || '?').charAt(0).toUpperCase()}</div>
        <div class="acc-info">
          <div class="acc-name">${a.userName}</div>
        </div>
        <div class="acc-badge ${a.signedToday ? 'badge-ok' : 'badge-miss'}">${a.signedToday ? '已签到' : '未签到'}</div>
        <div class="token-badge ${a.tokenValid === false ? 'token-invalid' : 'token-valid'}" title="${a.tokenValid === false ? (a.tokenReason || 'token失效') : 'token正常'}">${a.tokenValid === false ? '⚠️失效' : '✓正常'}</div>
      <button class="acc-signin-btn" onclick="runSignin('${a.userId}')" title="立即签到此账号">签到</button>
      </div>
      ${a.error ? `<div class="acc-err-msg">${a.error}</div>` : ''}
      <div class="acc-kpi">
        <div class="kpi-item"><div class="kpi-val num">${a.score.toLocaleString()}</div><div class="kpi-lbl">总积分</div></div>
        <div class="kpi-item"><div class="kpi-val num" style="color:#10B981">+${a.todayScore}</div><div class="kpi-lbl">今日积分</div></div>
        <div class="kpi-item"><div class="kpi-val num" style="color:#0891B2">${a.continueDays}</div><div class="kpi-lbl">连签天数</div></div>
        <div class="kpi-item"><div class="kpi-val num" style="color:#8B5CF6">${blindRemain}</div><div class="kpi-lbl">距盲盒</div></div>
      </div>
      <div class="blind-section">
        <div class="blind-label"><span>盲盒进度（第${blindRound}轮）</span><span class="num">${blindDay}/30 · ${blindPct}%</span></div>
        <div class="blind-bar"><div class="blind-fill" style="width:${blindPct}%"></div></div>
      </div>
      <div class="week-section">
        <div class="week-label">近 7 天签到</div>
        <div class="week-grid">${last7}</div>
      </div>
      ${a.vehicle && !a.vehicle.hasVehicle ? `<div class="no-vehicle-tip">🚗 该账号未绑定车辆</div>` : ''}
      ${a.vehicle && a.vehicle.hasVehicle ? `
      <div class="vehicle-section" onclick="showVehicleDetail(${idx})" style="cursor:pointer">
        <div class="vehicle-label">
          <span>🚗 ${a.vehicle.vehicleName || "车辆"} ${a.vehicle.vinNo ? `<span class="vin-no" id="vin_mask_${idx}">${maskVin(a.vehicle.vinNo)}</span><button type="button" class="vin-toggle-btn" onclick="event.stopPropagation();toggleVin(${idx},this)">显示</button>` : ""}</span>
          <span class="vbadge-group">
            ${onlineDisplay.text ? `<span class="vehicle-online ${onlineDisplay.cls}" title="车辆网络在线状态">${onlineDisplay.text}</span>` : ""}
            <span class="vehicle-charge ${isCharging ? "charging" : ""}">${a.vehicle.chargeState || "未充电"}</span>
            <span class="vehicle-power ${powerDisplay.cls}">${powerDisplay.text}</span>
          </span>
        </div>
        ${(lockDisplay.text || cushionText) ? `
        <div class="vehicle-status-row">
          ${lockDisplay.text ? `<span class="vstat ${lockDisplay.cls}">🔒 ${lockDisplay.text}</span>` : ""}
          ${cushionText ? `<span class="vstat vstat-cushion">💺 ${cushionText}</span>` : ""}
        </div>` : ""}
        ${isCharging ? `
        <div class="charge-progress-row">
          <div class="charge-progress-info">
            <span class="charge-icon">⚡</span>
            <span class="charge-percent">充电中 ${a.vehicle.batteryPercent}%</span>
            ${a.vehicle.batteryPercent >= 100 ? `<span class="charge-eta">已充满</span>` : (chargeEta ? `<span class="charge-eta">${chargeEta}</span>` : "")}
          </div>
        </div>` : ""}
        <div class="vehicle-kpi">
          <div class="v-kpi">
            <div class="v-kpi-val" style="color:${a.vehicle.batteryPercent <= 20 ? "#EF4444" : a.vehicle.batteryPercent <= 50 ? "#F59E0B" : "#0891B2"}">${a.vehicle.batteryPercent}%</div>
            <div class="v-kpi-lbl">电量SOC</div>
          </div>
          <div class="v-kpi">
            <div class="v-kpi-val">${a.vehicle.rangeEstimated ? "约" + a.vehicle.residualRangeKm : a.vehicle.residualRangeKm}</div>
            <div class="v-kpi-lbl">续航km</div>
          </div>
          <div class="v-kpi">
            <div class="v-kpi-val">${a.vehicle.todayDistance ? a.vehicle.todayDistance.toFixed(1) : "0"}</div>
            <div class="v-kpi-lbl">今日km</div>
          </div>
          <div class="v-kpi">
            <div class="v-kpi-val">${a.vehicle.todayDuration || 0}</div>
            <div class="v-kpi-lbl">骑行min</div>
          </div>
        </div>
        <div class="vehicle-bar">
          <div class="vehicle-bar-fill" style="width:${a.vehicle.batteryPercent}%;background:${a.vehicle.batteryPercent <= 20 ? "#EF4444" : a.vehicle.batteryPercent <= 50 ? "#F59E0B" : "#0891B2"}"></div>
        </div>
        ${(a.vehicle.frontPressure || a.vehicle.rearPressure) ? `
        <div class="tire-row">
          <div class="tire-item"><span class="tire-icon">🛞</span>前 ${a.vehicle.frontPressure || "-"} ${a.vehicle.frontTemp ? `<span class="tire-temp">${a.vehicle.frontTemp}</span>` : ""}</div>
          <div class="tire-item"><span class="tire-icon">🛞</span>后 ${a.vehicle.rearPressure || "-"} ${a.vehicle.rearTemp ? `<span class="tire-temp">${a.vehicle.rearTemp}</span>` : ""}</div>
        </div>` : ""}
        ${(a.vehicle.voltage || (isCharging && a.vehicle.current) || a.vehicle.batteryTemp) ? `
        <div class="battery-row">
          ${a.vehicle.voltage ? `<div class="battery-item"><span class="battery-icon">⚡</span>电压 ${a.vehicle.voltage.toFixed(1)}V</div>` : ""}
          ${isCharging && a.vehicle.current ? `<div class="battery-item"><span class="battery-icon">🔌</span>电流 ${a.vehicle.current.toFixed(1)}A</div>` : ""}
          ${a.vehicle.batteryTemp ? `<div class="battery-item"><span class="battery-icon">🌡️</span>电池温度 ${a.vehicle.batteryTemp.toFixed(0)}°C</div>` : ""}
        </div>` : ""}
        ${a.vehicle.serviceEndDate ? `
        <div class="service-row">
          <span class="service-icon">📅</span>
          <span class="service-text">服务到期 ${a.vehicle.serviceEndDate}</span>
        </div>` : ""}
        ${(a.vehicle.address || coordOk) ? `
        <div class="vehicle-addr">
          <span class="addr-text">📍 ${a.vehicle.address || "已获取GPS定位"}${a.vehicle.locationTime ? ` <span class="loc-time">· ${a.vehicle.locationTime}</span>` : ""}</span>
          <button type="button" class="map-btn ${coordOk ? "" : "map-btn-disabled"}" ${coordOk ? `onclick="event.stopPropagation();openMap(${idx})"` : "disabled title=\"暂无有效GPS坐标\""}>🗺️ 地图</button>
        </div>` : ""}
        <div class="vehicle-ctrl" onclick="event.stopPropagation()">
          <button class="vctrl-btn" onclick="vehicleCtrl('${a.userId}','find',this,'${v.vinNo || ''}')">🔔 寻车</button>
          <button class="vctrl-btn" onclick="vehicleCtrl('${a.userId}','loudFind',this,'${v.vinNo || ''}')">📣 鸣笛</button>
          <button class="vctrl-btn" onclick="vehicleCtrl('${a.userId}','cushion',this,'${v.vinNo || ''}')">💺 坐垫</button>
          <button class="vctrl-btn vctrl-unlock" onclick="vehicleCtrl('${a.userId}','unlock',this,'${v.vinNo || ''}')">🔓 开锁</button>
          <button class="vctrl-btn vctrl-lock" onclick="vehicleCtrl('${a.userId}','lock',this,'${v.vinNo || ''}')">🔒 关锁</button>
        </div>
      </div>` : ""}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>极核 ZEEHO 签到面板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:#F0F4F8;color:#0F172A;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.num{font-variant-numeric:tabular-nums}
.topbar{background:#fff;border-bottom:1px solid #E2E8F0;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;position:sticky;top:0;z-index:100}
.brand{display:flex;align-items:center;gap:10px}
.brand-mark{width:34px;height:34px;background:linear-gradient(135deg,#0891B2,#0E7490);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px;flex-shrink:0}
.brand-text h1{font-size:15px;font-weight:700}
.brand-text p{font-size:11px;color:#94A3B8;margin-top:1px}
.top-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.stat-chip{font-size:12px;color:#475569;background:#F1F5F9;padding:5px 12px;border-radius:14px;display:flex;align-items:center;gap:5px}
.stat-chip .dot{width:7px;height:7px;border-radius:50%;background:#10B981}
.nav-btn{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;border:1px solid #E2E8F0;background:#fff;color:#475569;cursor:pointer;text-decoration:none;display:inline-block;transition:all .15s;font-family:inherit}
.nav-btn:hover{background:#F1F5F9}
.nav-btn.primary{background:#0891B2;color:#fff;border-color:#0891B2}
.nav-btn.primary:hover{background:#0E7490}
.container{max-width:1100px;margin:0 auto;padding:18px 16px 40px}
.summary-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.summary-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;position:relative;overflow:hidden}
.summary-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
.summary-card.s1::before{background:#F59E0B}
.summary-card.s2::before{background:#0891B2}
.summary-card.s3::before{background:#10B981}
.summary-card .sl{font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;font-weight:500}
.summary-card .sv{font-size:26px;font-weight:900;margin-top:4px}
.summary-card .ss{font-size:11px;color:#64748B;margin-top:3px}
.cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.acc-card{background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:16px;transition:box-shadow .2s}
.acc-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.06)}
.acc-card.acc-error{border-color:#FCA5A5;background:#FEF2F2}
.acc-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.acc-avatar{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#0891B2,#0E7490);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}
.acc-info{flex:1;min-width:0}
.acc-name{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.acc-uid{font-size:11px;color:#94A3B8;margin-top:1px}
.acc-badge{font-size:11px;font-weight:600;padding:4px 10px;border-radius:10px;flex-shrink:0}
.badge-ok{background:#D1FAE5;color:#065F46}
.badge-miss{background:#FEE2E2;color:#991B1B}
.acc-err-msg{font-size:11px;color:#DC2626;background:#FEE2E2;padding:6px 10px;border-radius:6px;margin-bottom:10px}
.acc-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
.kpi-item{text-align:center;background:#F8FAFC;border-radius:8px;padding:8px 4px}
.kpi-val{font-size:18px;font-weight:800;color:#0F172A}
.kpi-lbl{font-size:10px;color:#94A3B8;margin-top:2px}
.blind-section{margin-bottom:12px}
.blind-label{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748B;margin-bottom:5px;font-weight:500}
.blind-bar{height:18px;background:#F1F5F9;border-radius:9px;overflow:hidden;border:1px solid #E2E8F0}
.blind-fill{height:100%;background:linear-gradient(90deg,#8B5CF6,#A78BFA);border-radius:8px;transition:width .5s ease}
.week-section{}
.week-label{font-size:11px;color:#64748B;font-weight:500;margin-bottom:6px}
.week-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.day-cell{aspect-ratio:1;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:9px}
.day-ok{background:#E0F7FB;border:1px solid #7DD3FC;color:#0E7490}
.day-miss{background:#F1F5F9;border:1px dashed #E2E8F0;color:#CBD5E1}
.day-today{background:#0891B2;border:1px solid #0E7490;color:#fff;box-shadow:0 0 0 2px #E0F7FB}
.day-num{font-weight:700;font-size:10px}
.day-mark{font-size:8px;margin-top:1px}
.vehicle-section{margin-top:12px;padding-top:12px;border-top:1px solid #F1F5F9}
.vehicle-label{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;color:#0F172A;margin-bottom:8px}
.vin-no{font-size:10px;color:#94A3B8;font-family:monospace;margin-left:6px;word-break:break-all;display:inline-block;max-width:140px}
.vin-toggle-btn{border:1px solid #CBD5E1;background:#fff;color:#0891B2;border-radius:6px;font-size:10px;font-weight:600;padding:1px 7px;margin-left:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;font-family:inherit;vertical-align:middle}
.vin-toggle-btn:active{transform:scale(.94)}
.vehicle-charge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;background:#F1F5F9;color:#64748B}
.vehicle-charge.charging{background:#D1FAE5;color:#065F46}
.vehicle-power{font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;margin-left:4px}
.vehicle-power.power-on{background:#D1FAE5;color:#065F46}
.vehicle-power.power-off{background:#F1F5F9;color:#64748B}
.vehicle-power.power-unknown{background:#FEF3C7;color:#92400E}
.vehicle-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}
.v-kpi{text-align:center;background:#F8FAFC;border-radius:6px;padding:6px 2px}
.v-kpi-val{font-size:14px;font-weight:800;color:#0F172A}
.v-kpi-lbl{font-size:9px;color:#94A3B8;margin-top:1px}
.vehicle-bar{height:10px;background:#F1F5F9;border-radius:5px;overflow:hidden;margin-bottom:8px}
.vehicle-bar-fill{height:100%;border-radius:5px;transition:width .5s ease}
.tire-row{display:flex;gap:12px;margin-bottom:6px}
.tire-item{font-size:11px;color:#475569;display:flex;align-items:center;gap:4px}
.tire-icon{font-size:12px}
.tire-temp{color:#0EA5E9;font-size:10px}
.battery-row{display:flex;gap:12px;margin-bottom:6px;flex-wrap:wrap}
.battery-item{font-size:11px;color:#475569;display:flex;align-items:center;gap:4px;background:#F8FAFC;padding:4px 8px;border-radius:6px}
.battery-icon{font-size:12px}
.charge-progress-row{margin-bottom:8px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:8px 10px}
.charge-progress-info{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.charge-icon{font-size:14px}
.charge-percent{font-size:13px;font-weight:700;color:#059669}
.charge-eta{font-size:11px;color:#059669;background:#D1FAE5;padding:2px 8px;border-radius:10px}
.vehicle-addr{font-size:10px;color:#94A3B8;margin-top:4px;display:flex;align-items:center;gap:6px}
.addr-text{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.loc-time{color:#CBD5E1;font-size:9px}
.map-btn{flex-shrink:0;border:1px solid #67E8F9;background:#ECFEFF;color:#0E7490;border-radius:6px;font-size:10px;font-weight:600;padding:3px 9px;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent}
.map-btn:active{transform:scale(.94)}
.map-btn.map-btn-disabled{opacity:.5;cursor:not-allowed;background:#F1F5F9;border-color:#E2E8F0;color:#94A3B8}
.vbadge-group{display:flex;align-items:center;gap:5px;flex-shrink:0}
.vehicle-online{font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;display:inline-flex;align-items:center;gap:3px}
.vehicle-online.online-on{background:#D1FAE5;color:#065F46}
.vehicle-online.online-off{background:#F1F5F9;color:#64748B}
.vehicle-online.online-unk{background:#FEF3C7;color:#92400E}
.vehicle-status-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.vstat{font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;background:#F1F5F9;color:#475569}
.vstat.lock-locked{background:#FEE2E2;color:#991B1B}
.vstat.lock-unlocked{background:#D1FAE5;color:#065F46}
.vstat.vstat-cushion{background:#EDE9FE;color:#5B21B6}
.log-filter{padding:5px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px;font-family:inherit;background:#fff;color:#334155;outline:none}
.log-tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 6px;border-radius:6px;margin-right:6px;vertical-align:middle}
.log-tag.tag-signin{background:#E0F7FB;color:#0E7490}
.log-tag.tag-vehicle{background:#FEF3C7;color:#92400E}
.vehicle-ctrl{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:9px;padding-top:9px;border-top:1px dashed #E2E8F0}
.vctrl-btn{border:1px solid #CBD5E1;background:#F8FAFC;color:#334155;border-radius:8px;padding:7px 2px;font-size:11px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all .15s}
.vctrl-btn:active{transform:scale(.94)}
.vctrl-btn:disabled{opacity:.55;cursor:not-allowed}
.vctrl-btn.vctrl-unlock{border-color:#86EFAC;background:#F0FDF4;color:#15803D}
.vctrl-btn.vctrl-lock{border-color:#FCA5A5;background:#FEF2F2;color:#B91C1C}
.service-row{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:#475569;flex-wrap:wrap}
.service-icon{font-size:12px}
.service-text{font-weight:600}
.service-remain{color:#0891B2;background:#E0F7FB;padding:1px 6px;border-radius:6px;font-size:10px}
.service-expired{color:#DC2626;background:#FEE2E2;padding:1px 6px;border-radius:6px;font-size:10px}
.no-vehicle-tip{margin-top:10px;padding:8px 12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;font-size:11px;color:#B45309;text-align:center}
.footer{text-align:center;padding:20px;font-size:11px;color:#94A3B8;margin-top:10px}
.footer a{color:#0891B2;text-decoration:none}
.empty-state{text-align:center;padding:60px 20px;color:#94A3B8}
.empty-state p{font-size:14px;margin-bottom:6px}
.empty-state .hint{font-size:12px;opacity:.7}
.config-info{font-size:10px;color:#94A3B8;margin-top:8px;text-align:center}
.token-badge{font-size:10px;font-weight:600;padding:3px 8px;border-radius:8px;flex-shrink:0;margin-left:6px}
.token-valid{background:#D1FAE5;color:#065F46}
.token-invalid{background:#FEE2E2;color:#991B1B}
.acc-signin-btn{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;border:1px solid #0891B2;background:#fff;color:#0891B2;cursor:pointer;flex-shrink:0;margin-left:6px;font-family:inherit}
.acc-signin-btn:hover{background:#0891B2;color:#fff}
.log-item{padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px}
.log-item:last-child{border-bottom:none}
.log-time{color:#94A3B8;font-size:11px;margin-bottom:2px}
.log-user{font-weight:700;color:#0F172A;margin-right:8px}
.log-result{color:#10B981;font-weight:600}
.log-result.err{color:#DC2626}
.log-steps{color:#64748B;margin-top:4px;font-size:11px;line-height:1.6}
@media(max-width:640px){.summary-row{grid-template-columns:1fr}.cards-grid{grid-template-columns:1fr}.acc-kpi{grid-template-columns:repeat(2,1fr)}.topbar{padding:12px 14px}.container{padding:14px 12px 30px}}
</style></head><body>
<div class="topbar">
  <div class="brand"><div class="brand-mark">Z</div><div class="brand-text"><h1>极核 ZEEHO 签到面板</h1><p>${data.length} 个账号 · 实时数据</p></div></div>
  <div class="top-actions">
    <div class="stat-chip"><span class="dot"></span><span id="signedInfo">${signedCount}/${data.length} 已签到</span></div>
    <button class="nav-btn" onclick="switchTab('dashboard')">数据</button>
    <button class="nav-btn" onclick="switchTab('logs')">日志</button>
    <a href="/config" class="nav-btn">配置</a>
    <button class="nav-btn primary" onclick="runAllSignin()">立即签到</button>
    <button class="nav-btn" id="autoRefreshBtn" onclick="toggleAutoRefresh()" style="background:#0891B2;color:#fff">自动刷新(${cfg.autoRefreshSec || 60}s)</button>
    <button class="nav-btn" onclick="location.reload()">刷新</button>
  </div>
</div>
<div class="container" id="dashboardPage">
  ${data.length === 0 ? `
  <div class="empty-state">
    <p>未找到极核账号</p>
    <p class="hint">请先在「配置」页面添加账号（Authorization Bearer token），或运行签到脚本抓 Cookie</p>
    <a href="/config" class="nav-btn primary" style="margin-top:16px">去添加账号</a>
  </div>` : `
  <div class="summary-row">
    <div class="summary-card s1"><div class="sl">账号总积分</div><div class="sv num">${totalScore.toLocaleString()}</div><div class="ss">${data.length} 个账号合计</div></div>
    <div class="summary-card s2"><div class="sl">今日签到</div><div class="sv num">${signedCount} / ${data.length}</div><div class="ss">${data.length - signedCount > 0 ? (data.length - signedCount) + ' 个未签到' : '全部已签到'}</div></div>
    <div class="summary-card s3"><div class="sl">数据更新时间</div><div class="sv" style="font-size:18px;padding-top:6px">${updateTime}</div><div class="ss">来自代理工具实时 API</div></div>
  </div>
  <div class="cards-grid">${cards}</div>
  <div class="config-info">App端 appId: ${cfg.app.appId} · H5端 appId: ${cfg.h5.appId} · 可在「配置」页修改</div>
  `}
</div>
<!-- 运行日志页面 -->
<div id="logsPage" style="display:none">
  <div class="panel" style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;margin-bottom:16px;overflow:hidden">
    <div class="panel-head" style="padding:14px 18px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between">
      <div class="panel-title" style="font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px"><span class="bar" style="width:3px;height:14px;border-radius:2px;background:#8B5CF6"></span>运行日志（最近50条）</div>
      <div style="display:flex;align-items:center;gap:8px">
        <select id="logFilter" class="log-filter" onchange="loadLogs()">
          <option value="all">全部类型</option>
          <option value="signin">仅签到</option>
          <option value="vehicle">仅控车</option>
        </select>
        <button class="nav-btn" onclick="clearLogs()" style="padding:5px 12px;font-size:11px">清空日志</button>
      </div>
    </div>
    <div id="logsList" style="padding:14px 18px;max-height:70vh;overflow-y:auto"></div>
  </div>
</div>

<!-- 签到结果弹窗 -->
<div id="signinModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px">
  <div style="background:#fff;border-radius:14px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="font-size:16px;font-weight:700">签到执行结果</h3>
      <button onclick="closeModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94A3B8">×</button>
    </div>
    <div id="signinResult"></div>
  </div>
</div>

<!-- 车辆详情弹窗 -->
<div id="vehicleModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center;padding:20px">
  <div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700" id="vModalTitle">车辆详情</h3>
      <button onclick="closeVehicleModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94A3B8">×</button>
    </div>
    <div id="vehicleDetailContent"></div>
  </div>
</div>

<div class="footer">极核 ZEEHO 签到看板 · 作者 <a href="https://github.com/mlink798">lucky</a> · 数据来自代理工具实时 API<br><span style="font-size:10px;color:#CBD5E1;margin-top:4px;display:inline-block">脚本版本 ${SCRIPT_VERSION}</span></div>
<script>
var vehicleDataList = ${JSON.stringify(data.map(function(a){ return a.vehicle || {}; }))};
var AUTO_REFRESH_SEC = ${cfg.autoRefreshSec || 60};
var autoRefreshTimer = null;
var autoRefreshCountdown = AUTO_REFRESH_SEC;
// 浏览器端坐标校验（与后端 hasValidCoord 同逻辑，独立一份供浏览器内函数调用）
function hasValidCoord(lat, lng) { if (lat === "" || lat === null || lat === undefined || lng === "" || lng === null || lng === undefined) return false; lat = Number(lat); lng = Number(lng); return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0); }
// 跳转地图查看车辆定位：iPhone 优先苹果地图（q=纬度,经度）；坐标非法时提示
function openMap(idx) {
  var v = vehicleDataList[idx]; if (!v) return;
  if (!hasValidCoord(v.latitude, v.longitude)) { showToast('暂无有效GPS坐标', 'err'); return; }
  var lat = Number(v.latitude), lng = Number(v.longitude);
  var url = 'https://maps.apple.com/?q=' + lat + ',' + lng + '&z=17';
  window.open(url, '_blank');
}
function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshCountdown = AUTO_REFRESH_SEC;
  updateAutoRefreshBtn();
  autoRefreshTimer = setInterval(function() {
    autoRefreshCountdown--;
    // 负数保护
    if (autoRefreshCountdown < 0) autoRefreshCountdown = 0;
    updateAutoRefreshBtn();
    if (autoRefreshCountdown <= 0) {
      if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
      location.reload();
    }
  }, 1000);
}
function updateAutoRefreshBtn() {
  var btn = document.getElementById('autoRefreshBtn');
  if (btn) btn.textContent = '自动刷新(' + autoRefreshCountdown + 's)';
}
function toggleAutoRefresh() {
  var btn = document.getElementById('autoRefreshBtn');
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
    btn.textContent = '开启自动刷新';
    btn.style.background = '#fff';
    btn.style.color = '#475569';
  } else {
    startAutoRefresh();
    btn.style.background = '#0891B2';
    btn.style.color = '#fff';
  }
}
startAutoRefresh();
function switchTab(tab) {
  document.getElementById('dashboardPage').style.display = tab === 'dashboard' ? 'block' : 'none';
  document.getElementById('logsPage').style.display = tab === 'logs' ? 'block' : 'none';
  if (tab === 'logs') loadLogs();
}
function loadLogs() {
  var filterEl = document.getElementById('logFilter');
  var filter = filterEl ? filterEl.value : 'all';
  fetch('/api/get-logs').then(function(r){return r.json()}).then(function(d){
    var list = document.getElementById('logsList');
    var all = d.logs || [];
    if (all.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">暂无运行日志</div>';
      return;
    }
    // 旧日志没有 type 字段，统一按签到(signin)兜底，避免历史记录在筛选时被吞掉
    var logs = all.filter(function(log){
      var t = log.type || 'signin';
      if (filter === 'all') return true;
      return t === filter;
    });
    if (logs.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">该分类下暂无日志</div>';
      return;
    }
    list.innerHTML = logs.map(function(log){
      var t = log.type || 'signin';
      var tag = t === 'vehicle' ? '<span class="log-tag tag-vehicle">控车</span>' : '<span class="log-tag tag-signin">签到</span>';
      var result = '';
      if (t === 'vehicle') {
        result = '<span class="log-result '+(log.success?'':'err')+'">'+(log.actionText || '车辆控制')+' '+(log.success ? '成功' : ('失败：'+(log.message || log.error || '未知')))+'</span>';
      } else {
        result = '<span class="log-result '+(log.success?'':'err')+'">'+(log.success?('成功 +'+log.totalGain):('失败: '+(log.error||'未知')))+'</span>';
      }
      var steps = log.steps ? log.steps.map(function(s){return '<div>· '+s+'</div>'}).join('') : '';
      return '<div class="log-item"><div class="log-time">'+log.time+'</div><div>'+tag+'<span class="log-user">'+(log.userName || '')+'</span>'+result+'</div>'+(steps?'<div class="log-steps">'+steps+'</div>':'')+'</div>';
    }).join('');
  }).catch(function(){document.getElementById('logsList').innerHTML='<div style="text-align:center;padding:40px;color:#DC2626">加载失败</div>'});
}
function clearLogs() {
  if (!confirm('确定清空所有运行日志？')) return;
  fetch('/api/clear-logs',{method:'POST'}).then(function(r){return r.json()}).then(function(d){
    if (d.ok) { loadLogs(); showToast('日志已清空'); }
  });
}
function runAllSignin() {
  if (!confirm('确定立即执行所有账号签到？')) return;
  showToast('正在执行签到...');
  fetch('/api/run-signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({all:true})})
    .then(function(r){return r.json()})
    .then(function(d){ showSigninResult(d); })
    .catch(function(){ showToast('执行失败','err'); });
}
function runSignin(userId) {
  showToast('正在签到...');
  fetch('/api/run-signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:userId})})
    .then(function(r){return r.json()})
    .then(function(d){ showSigninResult(d); })
    .catch(function(){ showToast('执行失败','err'); });
}
function showSigninResult(d) {
  var modal = document.getElementById('signinModal');
  var result = document.getElementById('signinResult');
  modal.style.display = 'flex';
  var html = '';
  if (d.results && d.results.length > 0) {
    html = d.results.map(function(r){
      var steps = r.steps ? r.steps.map(function(s){return '<div style="color:#64748B;font-size:12px;margin:2px 0">· '+s+'</div>'}).join('') : '';
      return '<div style="padding:12px;border:1px solid '+(r.success?'#D1FAE5':'#FEE2E2')+';border-radius:10px;margin-bottom:10px;background:'+(r.success?'#F0FDF4':'#FEF2F2')+'"><div style="font-weight:700;font-size:14px;margin-bottom:4px">'+r.userName+' <span style="color:'+(r.success?'#10B981':'#DC2626')+';font-size:12px">'+(r.success?('成功 +'+r.totalGain):'失败')+'</span></div>'+(r.error?'<div style="color:#DC2626;font-size:12px">'+r.error+'</div>':'')+steps+'</div>';
    }).join('');
  } else {
    html = '<div style="text-align:center;color:#94A3B8;padding:20px">无结果</div>';
  }
  result.innerHTML = html;
  setTimeout(function(){ location.reload(); }, 3000);
}
function closeModal() {
  document.getElementById('signinModal').style.display = 'none';
}
// 注意：vehicleDataList 已在看板脚本顶部渲染时注入真实车辆数据，此处禁止再用空数组覆盖，
// 否则卡片车架号“显示”按钮、车辆详情弹窗都会因取不到 vehicleDataList[idx] 而无反应
function showVehicleDetail(idx) {
  var v = vehicleDataList[idx];
  if (!v) return;
  var modal = document.getElementById('vehicleModal');
  var content = document.getElementById('vehicleDetailContent');
  document.getElementById('vModalTitle').textContent = v.vehicleName || '车辆详情';
  var rows = [];
  if (v.vinNo) rows.push('<div class="v-detail-row"><span class="v-detail-label">车架号</span><span><span class="v-detail-val" id="vin_detail_mask" style="font-family:monospace;font-size:12px">'+maskVin(v.vinNo)+'</span> <button type="button" class="vin-toggle-btn" onclick="toggleDetailVin('+idx+',this)">显示</button></span></div>');
  rows.push('<div class="v-detail-row"><span class="v-detail-label">充电状态</span><span class="v-detail-val">'+(v.chargeState || '未充电')+'</span></div>');
  // 电源状态（开关机）：优先电源字段，其次用车锁推断（开锁=上电/开机，锁车=下电/关机）
  var powerText = "状态未知", powerColor = "#92400E";
  var p = String(v.powerStatus || "").toLowerCase().trim();
  var l = String(v.lockState || "").toLowerCase().trim();
  var onVals = ["1","on","true","开机","open","激活","acc_on","acc on","power_on","power on","已开机","已上电"];
  var offVals = ["0","off","false","关机","closed","待机","acc_off","acc off","power_off","power off","已关机","已下电"];
  if (p) {
    if (onVals.indexOf(p) >= 0) { powerText = "已开机"; powerColor = "#065F46"; }
    else if (offVals.indexOf(p) >= 0) { powerText = "已关机"; powerColor = "#64748B"; }
  } else if (l) {
    var lockOnVals = ["0","未锁","开锁","unlocked","false","open","已开锁","未锁车"];
    var lockOffVals = ["1","已锁","锁车","locked","true","closed","已锁车"];
    if (lockOnVals.indexOf(l) >= 0) { powerText = "已开机"; powerColor = "#065F46"; }
    else if (lockOffVals.indexOf(l) >= 0) { powerText = "已关机"; powerColor = "#64748B"; }
  }
  rows.push('<div class="v-detail-row"><span class="v-detail-label">电源状态</span><span class="v-detail-val" style="color:'+powerColor+'">'+powerText+'</span></div>');
  if (v.rideState || v.online) rows.push('<div class="v-detail-row"><span class="v-detail-label">车辆状态</span><span class="v-detail-val">'+(v.rideState || v.online)+'</span></div>');
  rows.push('<div class="v-detail-row"><span class="v-detail-label">电量SOC</span><span class="v-detail-val" style="font-weight:700;color:'+(v.batteryPercent<=20?'#EF4444':v.batteryPercent<=50?'#F59E0B':'#0891B2')+'">'+v.batteryPercent+'%</span></div>');
  if (v.voltage) rows.push('<div class="v-detail-row"><span class="v-detail-label">电压</span><span class="v-detail-val">'+v.voltage.toFixed(1)+'V</span></div>');
  if (v.current) rows.push('<div class="v-detail-row"><span class="v-detail-label">电流</span><span class="v-detail-val">'+v.current.toFixed(1)+'A</span></div>');
  if (v.batteryTemp) rows.push('<div class="v-detail-row"><span class="v-detail-label">电池温度</span><span class="v-detail-val">'+v.batteryTemp.toFixed(0)+'°C</span></div>');
  rows.push('<div class="v-detail-row"><span class="v-detail-label">剩余续航</span><span class="v-detail-val">'+v.residualRangeKm+'km</span></div>');
  rows.push('<div class="v-detail-row"><span class="v-detail-label">今日骑行</span><span class="v-detail-val">'+(v.todayDistance?v.todayDistance.toFixed(1):0)+'km / '+(v.todayDuration||0)+'min</span></div>');
  var hasTire = (v.frontPressure && v.frontPressure !== "未绑定") || (v.rearPressure && v.rearPressure !== "未绑定");
  if (hasTire) rows.push('<div class="v-detail-row"><span class="v-detail-label">胎压</span><span class="v-detail-val">前'+(v.frontPressure||'-')+' / 后'+(v.rearPressure||'-')+'</span></div>');
  if (v.address) rows.push('<div class="v-detail-row"><span class="v-detail-label">车辆位置</span><span class="v-detail-val" style="font-size:12px">'+v.address+'</span></div>');
  var dCoordOk = hasValidCoord(v.latitude, v.longitude);
  if (dCoordOk) rows.push('<div class="v-detail-row"><span class="v-detail-label">GPS坐标</span><span class="v-detail-val" style="font-family:monospace;font-size:11px">'+Number(v.latitude).toFixed(6)+', '+Number(v.longitude).toFixed(6)+'</span></div>');
  rows.push('<div class="v-detail-row"><span class="v-detail-label">地图定位</span><span><button type="button" class="vin-toggle-btn" '+(dCoordOk ? 'onclick="openMap('+idx+')"' : 'disabled')+' style="'+(dCoordOk ? '' : 'opacity:.45;cursor:not-allowed')+'">🗺️ '+(dCoordOk ? '在地图中查看' : '暂无GPS坐标')+'</button></span></div>');
  if (v.locationTime) rows.push('<div class="v-detail-row"><span class="v-detail-label">最后定位</span><span class="v-detail-val" style="font-size:11px;color:#94A3B8">'+v.locationTime+'</span></div>');
  if (v.serviceEndDate) rows.push('<div class="v-detail-row"><span class="v-detail-label">服务到期</span><span class="v-detail-val">'+v.serviceEndDate+'</span></div>');
  content.innerHTML = '<div class="v-detail-container">'+rows.join('')+'</div><style>.v-detail-container{display:flex;flex-direction:column;gap:0}.v-detail-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #F1F5F9}.v-detail-row:last-child{border-bottom:none}.v-detail-label{font-size:12px;color:#64748B;font-weight:500}.v-detail-val{font-size:13px;color:#0F172A;font-weight:600}</style>';
  modal.style.display = 'flex';
}
function closeVehicleModal() {
  document.getElementById('vehicleModal').style.display = 'none';
}
// 车架号默认打码，点击“显示/隐藏”切换（卡片 & 详情弹窗）
function maskVin(v){ if(!v) return ''; v=String(v); if(v.length<=7) return '****'; return v.substring(0,3)+'****'+v.substring(v.length-4); }
function toggleVin(idx, btn){
  var v = vehicleDataList[idx]; if(!v||!v.vinNo) return;
  var el = document.getElementById('vin_mask_'+idx); if(!el) return;
  if(el.textContent.indexOf('*')>=0){ el.textContent=v.vinNo; btn.textContent='隐藏'; }
  else { el.textContent=maskVin(v.vinNo); btn.textContent='显示'; }
}
function toggleDetailVin(idx, btn){
  var v = vehicleDataList[idx]; if(!v||!v.vinNo) return;
  var el = document.getElementById('vin_detail_mask'); if(!el) return;
  if(el.textContent.indexOf('*')>=0){ el.textContent=v.vinNo; btn.textContent='隐藏'; }
  else { el.textContent=maskVin(v.vinNo); btn.textContent='显示'; }
}
// 车辆远程控制：寻车/鸣笛闪灯/开坐垫/云端开关锁（均真实控车，需二次确认）
// 2026-09-20 修复：增加 vin 参数，切换车辆后控车操作对应选中车辆
function vehicleCtrl(userId, action, btn, vin) {
  var names = { find:'短按寻车（车辆闪灯）', loudFind:'鸣笛闪灯（高声寻车）', cushion:'打开坐垫（坐垫会弹起）', unlock:'云端开锁', lock:'云端关锁' };
  var name = names[action] || action;
  if (!confirm('确定执行【' + name + '】吗？\\n该指令会通过 4G 网络真实控制你的车辆！')) return;
  var old = btn.textContent;
  btn.disabled = true; btn.textContent = '···';
  showToast('指令下发中…');
  fetch('/api/vehicle-control', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:userId, action:action, vin: vin || '' }) })
    .then(function(r){ return r.json(); })
    .then(function(d){
      btn.disabled = false; btn.textContent = old;
      showToast(d.ok ? ('✅ ' + d.message) : ('❌ ' + (d.message || '指令失败')), d.ok ? '' : 'err');
    })
    .catch(function(e){
      btn.disabled = false; btn.textContent = old;
      showToast('❌ ' + e, 'err');
    });
}
function showToast(msg, type) {
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:10000;'+(type==='err'?'background:#EF4444;color:#fff':'background:#10B981;color:#fff');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 2000);
}
</script>
</body></html>`;
}

// ========== HTML: 配置页 ==========
function renderConfig(accounts, cfg) {
  const accRows = accounts.map((a, idx) => `
    <div class="acc-row" data-idx="${idx}">
      <div class="acc-row-head">
        <span class="acc-row-title">账号 ${idx + 1}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="refreshUserId(${idx})" id="refresh_btn_${idx}">获取ID</button>
          <button class="btn btn-sm btn-danger" onclick="deleteAccount(${idx})">删除</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-item"><label>昵称</label><input type="text" id="acc_name_${idx}" value="${a.userName || ''}" placeholder="lucky798"></div>
        <div class="form-item"><label>用户ID</label><input type="text" id="acc_uid_${idx}" value="${a.userId || ''}" placeholder="20251009..." style="font-family:monospace;font-size:12px"></div>
      </div>
      <div class="form-item" style="margin-top:8px"><label>Authorization Token（直接粘贴即可，会自动去掉 Bearer 前缀）</label>
        <input type="text" id="acc_token_${idx}" value="${a.token || ''}" placeholder="a74779c7-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style="font-family:monospace;font-size:12px">
      </div>
      <div class="form-item" style="margin-top:8px"><label>Bark 通知 Key（选填，仅该账号签到成功后推送，留空不推）</label>
        <input type="text" id="acc_bark_${idx}" value="${a.barkKey || ''}" placeholder="Bark App 内的 Key，或自建服务器 https://域名/Key" style="font-family:monospace;font-size:12px">
      </div>

    </div>`).join('');


  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>极核 ZEEHO · 配置</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:#F0F4F8;color:#0F172A;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.num{font-variant-numeric:tabular-nums}
.topbar{background:#fff;border-bottom:1px solid #E2E8F0;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;position:sticky;top:0;z-index:100}
.brand{display:flex;align-items:center;gap:10px}
.brand-mark{width:34px;height:34px;background:linear-gradient(135deg,#0891B2,#0E7490);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px;flex-shrink:0}
.brand-text h1{font-size:15px;font-weight:700}
.brand-text p{font-size:11px;color:#94A3B8;margin-top:1px}
.nav-btn{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;border:1px solid #E2E8F0;background:#fff;color:#475569;cursor:pointer;text-decoration:none;display:inline-block;transition:all .15s;font-family:inherit}
.nav-btn:hover{background:#F1F5F9}
.nav-btn.primary{background:#0891B2;color:#fff;border-color:#0891B2}
.container{max-width:800px;margin:0 auto;padding:18px 16px 40px}
.panel{background:#fff;border:1px solid #E2E8F0;border-radius:12px;margin-bottom:16px;overflow:hidden}
.panel-head{padding:14px 18px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between}
.panel-title{font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px}
.panel-title .bar{width:3px;height:14px;border-radius:2px;background:#0891B2}
.panel-body{padding:18px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-item{margin-bottom:0}
.form-item label{display:block;font-size:11px;color:#64748B;margin-bottom:4px;font-weight:500}
.form-item input,.form-item select{width:100%;padding:9px 11px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#FAFBFC}
.form-item input:focus{border-color:#0891B2;box-shadow:0 0 0 3px #E0F7FB}
.form-item.full{grid-column:1/-1}
.switch-label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#334155;padding:8px 0}
.switch-label input[type="checkbox"]{width:18px;height:18px;accent-color:#0891B2;cursor:pointer}
.btn{padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;border:1px solid #E2E8F0;background:#fff;color:#475569;cursor:pointer;transition:all .15s;font-family:inherit}
.btn:hover{background:#F1F5F9}
.btn-primary{background:#0891B2;color:#fff;border-color:#0891B2}
.btn-primary:hover{background:#0E7490}
.btn-danger{background:#FEE2E2;color:#991B1B;border-color:#FECACA}
.btn-danger:hover{background:#FECACA}
.btn-sm{padding:5px 12px;font-size:11px}
.btn-row{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
.acc-row{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:12px}
.acc-row-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.acc-row-title{font-size:13px;font-weight:700;color:#0F172A}
.hint{font-size:11px;color:#94A3B8;margin-top:6px;line-height:1.6}
.hint code{background:#F1F5F9;padding:1px 5px;border-radius:4px;font-size:11px}
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;opacity:0;transition:opacity .3s;pointer-events:none}
.toast.show{opacity:1}
.toast.ok{background:#10B981;color:#fff}
.toast.err{background:#EF4444;color:#fff}
@media(max-width:640px){.form-grid{grid-template-columns:1fr}.container{padding:14px 12px 30px}}
</style></head><body>
<div class="topbar">
  <div class="brand"><div class="brand-mark">Z</div><div class="brand-text"><h1>极核 ZEEHO · 配置</h1><p>签名密钥 & 账号管理</p></div></div>
  <div><a href="/" class="nav-btn primary">返回面板</a></div>
</div>
<div class="container">

  <!-- 签名配置 -->
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title"><span class="bar"></span>签名密钥配置</div>
    </div>
    <div class="panel-body">
      <div class="form-grid">
        <div class="form-item"><label>App端 appId</label><input type="text" id="cfg_app_id" value="${cfg.app.appId}"></div>
        <div class="form-item"><label>App端 appSecret</label><input type="text" id="cfg_app_secret" value="${cfg.app.appSecret}" style="font-family:monospace;font-size:11px"></div>
        <div class="form-item"><label>H5端 appId</label><input type="text" id="cfg_h5_id" value="${cfg.h5.appId}"></div>
        <div class="form-item"><label>H5端 appSecret</label><input type="text" id="cfg_h5_secret" value="${cfg.h5.appSecret}" style="font-family:monospace;font-size:11px"></div>
        <div class="form-item" style="grid-column:1/-1"><label>云端控车 AES 密钥（开/关锁必填，32位）</label><input type="text" id="cfg_vehicle_key" value="${cfg.vehicleAesKey || ''}" placeholder="填写并保存后才能使用云端开锁/关锁；留空则开关锁功能禁用" autocomplete="off" style="font-family:monospace;font-size:11px"></div>
        <div class="form-item"><label>看板自动刷新间隔（秒，范围15~3600，默认60；填非法值自动回退60）</label><input type="number" min="15" max="3600" step="5" id="cfg_refresh_sec" value="${cfg.autoRefreshSec || 60}"></div>
      </div>
      <div class="hint">修改后点击「保存配置」生效。App/H5 密钥用于极核 API 签名计算（md5(sha1(param+secret))）；<b>云端控车密钥用于开/关锁报文加密，出于安全默认不内置，需自行填写保存一次，未填写时开关锁会被禁用。</b></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="saveConfig()">保存配置</button>
        <button class="btn" onclick="resetConfig()">恢复默认</button>
      </div>
    </div>
  </div>

  <!-- 社区任务开关 -->
  <div class="panel">
    <div class="panel-head"><div class="panel-title"><span class="bar" style="background:#F59E0B"></span>社区任务开关</div></div>
    <div class="panel-body">
      <div class="form-grid">
        <div class="form-item"><label class="switch-label"><input type="checkbox" id="comm_post" ${cfg.community?.enablePost !== false ? "checked" : ""}> 发布动态（+1分）</label></div>
        <div class="form-item"><label class="switch-label"><input type="checkbox" id="comm_like" ${cfg.community?.enableLike !== false ? "checked" : ""}> 点赞动态（+1分）</label></div>
        <div class="form-item"><label class="switch-label"><input type="checkbox" id="comm_comment" ${cfg.community?.enableComment !== false ? "checked" : ""}> 评论动态（不加分）</label></div>
        <div class="form-item"><label class="switch-label"><input type="checkbox" id="comm_share" ${cfg.community?.enableShare !== false ? "checked" : ""}> 分享动态（+1分）</label></div>
        <div class="form-item"><label class="switch-label"><input type="checkbox" id="comm_delete" ${cfg.community?.enableDelete !== false ? "checked" : ""}> 执行后删除动态</label></div>
      </div>
      <div class="hint">关闭对应开关后，签到脚本将跳过该任务。修改后点击下方「保存配置」生效。</div>
    </div>
  </div>

  <!-- 手机号登录 -->
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title"><span class="bar" style="background:#6366F1"></span>手机号登录（免抓包）</div>
    </div>
    <div class="panel-body">
      <div class="form-grid">
        <div class="form-item"><label>手机号（极核 App 绑定号码）</label><input type="tel" id="pl_phone" placeholder="11 位手机号" style="font-family:monospace;font-size:13px"></div>
        <div class="form-item"><label>短信验证码</label><input type="text" id="pl_code" placeholder="6 位验证码" style="font-family:monospace;font-size:13px"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-sm" onclick="sendSmsCode()" id="pl_send_btn">获取验证码</button>
        <button class="btn btn-primary" onclick="phoneLogin()" id="pl_login_btn">登录并添加账号</button>
      </div>
      <div class="hint">用手机号 + 短信验证码登录，自动获取 Token 与用户ID并加入账号列表，全程无需抓包。登录成功后会自动写入并刷新页面。</div>
    </div>
  </div>

  <!-- 账号管理 -->
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title"><span class="bar" style="background:#10B981"></span>账号管理（${accounts.length} 个）</div>
      <button class="btn btn-sm" onclick="addAccount()">+ 添加账号</button>
    </div>
    <div class="panel-body">
      <div id="accList">${accRows || '<div style="text-align:center;padding:20px;color:#94A3B8;font-size:13px">暂无账号，点击上方「添加账号」</div>'}</div>
      <div class="hint">Token 格式：直接粘贴抓包得到的 Authorization 值即可，即使带了 <code>Bearer </code> 前缀，保存时也会自动去掉、只保留后面的 Token。<br>每账号可单独填 Bark Key：该账号签到成功后推送一条通知（标题含昵称、内容含得分明细），留空则该账号不推送；支持官方 Key 或自建服务器地址。<br>用户ID获取：打开极核App-我的，抓包 <code>/setting/{userId}</code> 接口，响应体 <code>data.id</code> 即为用户ID。</div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="saveAccounts()">保存极核账号</button>
      </div>
    </div>

  </div>

</div>
<div id="toast" class="toast"></div>
<script>
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type || 'ok');
  setTimeout(function(){ t.className = 'toast'; }, 2000);
}
function saveConfig() {
  var data = {
    app: { appId: document.getElementById('cfg_app_id').value, appSecret: document.getElementById('cfg_app_secret').value },
    h5: { appId: document.getElementById('cfg_h5_id').value, appSecret: document.getElementById('cfg_h5_secret').value },
    vehicleAesKey: (document.getElementById('cfg_vehicle_key').value || '').trim(),
    autoRefreshSec: Number(document.getElementById('cfg_refresh_sec').value),
    community: {
      enablePost: document.getElementById('comm_post').checked,
      enableLike: document.getElementById('comm_like').checked,
      enableComment: document.getElementById('comm_comment').checked,
      enableShare: document.getElementById('comm_share').checked,
      enableDelete: document.getElementById('comm_delete').checked
    }
  };
  fetch('/api/save-config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })
    .then(function(r){ return r.json(); })
    .then(function(d){ if(d.ok){ showToast('配置已保存'); } else { showToast('保存失败', 'err'); } })
    .catch(function(){ showToast('保存失败', 'err'); });
}
function resetConfig() {
  document.getElementById('cfg_app_id').value = 'S7qPWPU1';
  document.getElementById('cfg_app_secret').value = 'c5e0da7f4da28df805694ec3dd1fc6792e9df99d';
  document.getElementById('cfg_h5_id').value = 'Sw5F9uJi';
  document.getElementById('cfg_h5_secret').value = '46870a8f678a09109468f5b0168818b91c292845';
  document.getElementById('cfg_vehicle_key').value = '';
  document.getElementById('cfg_refresh_sec').value = 60;
  document.getElementById('comm_post').checked = true;
  document.getElementById('comm_like').checked = true;
  document.getElementById('comm_comment').checked = true;
  document.getElementById('comm_share').checked = true;
  document.getElementById('comm_delete').checked = true;
  showToast('已恢复默认（需点击保存）');
}
var accCount = ${accounts.length};
function addAccount() {
  accCount++;
  var idx = accCount - 1;
  var html = '<div class="acc-row" data-idx="'+idx+'"><div class="acc-row-head"><span class="acc-row-title">账号 '+accCount+'（新）</span><div style="display:flex;gap:6px"><button class="btn btn-sm" onclick="refreshUserId('+idx+')" id="refresh_btn_'+idx+'">获取ID</button><button class="btn btn-sm btn-danger" onclick="deleteAccount('+idx+')">删除</button></div></div><div class="form-grid"><div class="form-item"><label>昵称</label><input type="text" id="acc_name_'+idx+'" placeholder="lucky798"></div><div class="form-item"><label>用户ID</label><input type="text" id="acc_uid_'+idx+'" placeholder="20251009..." style="font-family:monospace;font-size:12px"></div></div><div class="form-item" style="margin-top:8px"><label>Authorization Token（自动去掉 Bearer 前缀）</label><input type="text" id="acc_token_'+idx+'" placeholder="a74779c7-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style="font-family:monospace;font-size:12px"></div><div class="form-item" style="margin-top:8px"><label>Bark 通知 Key（选填）</label><input type="text" id="acc_bark_'+idx+'" placeholder="Bark Key 或自建 https://域名/Key，留空不推" style="font-family:monospace;font-size:12px"></div></div>';
  var list = document.getElementById('accList');
  if (list.querySelector('.acc-row') || list.querySelector('[style*="text-align"]')) {
    list.insertAdjacentHTML('beforeend', html);
  } else {
    list.innerHTML = html;
  }
}
function deleteAccount(idx) {
  var row = document.querySelector('.acc-row[data-idx="'+idx+'"]');
  if (row) { row.remove(); showToast('已删除（需点击保存）'); }
}
function refreshUserId(idx) {
  var tokenEl = document.getElementById('acc_token_'+idx);
  var uidEl = document.getElementById('acc_uid_'+idx);
  var nameEl = document.getElementById('acc_name_'+idx);
  var btn = document.getElementById('refresh_btn_'+idx);
  if (!tokenEl || !tokenEl.value.trim()) { showToast('请先填写Token', 'err'); return; }
  btn.textContent = '获取中...';
  btn.disabled = true;
  fetch('/api/get-userid', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token: tokenEl.value.trim()}) })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.ok && d.userId) {
        if (uidEl) uidEl.value = d.userId;
        if (nameEl && d.userName && !nameEl.value) nameEl.value = d.userName;
        showToast('获取成功: '+(d.userName||d.userId));
      } else {
        showToast('获取失败: '+(d.error||'未知错误'), 'err');
      }
    })
    .catch(function(){ showToast('获取失败', 'err'); })
    .finally(function(){ btn.textContent = '获取ID'; btn.disabled = false; });
}
function sendSmsCode() {
  var phoneEl = document.getElementById('pl_phone');
  var btn = document.getElementById('pl_send_btn');
  var phone = (phoneEl ? phoneEl.value : '').trim();
  if (!/^1\d{10}$/.test(phone)) { showToast('请输入正确的11位手机号', 'err'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '发送中...'; }
  fetch('/api/send-code', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({phone: phone}) })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.ok) { showToast(d.message || '验证码已发送'); }
      else { showToast(d.message || '发送失败', 'err'); }
      var t = 60;
      if (btn) {
        btn.textContent = t + 's 后重试';
        var iv = setInterval(function(){
          t--;
          if (t <= 0) { clearInterval(iv); btn.textContent = '获取验证码'; btn.disabled = false; }
          else { btn.textContent = t + 's 后重试'; }
        }, 1000);
      }
    })
    .catch(function(){ showToast('发送失败，请检查网络', 'err'); if (btn) { btn.disabled = false; btn.textContent = '获取验证码'; } });
}
function phoneLogin() {
  var phoneEl = document.getElementById('pl_phone');
  var codeEl = document.getElementById('pl_code');
  var btn = document.getElementById('pl_login_btn');
  var phone = (phoneEl ? phoneEl.value : '').trim();
  var code = (codeEl ? codeEl.value : '').trim();
  if (!/^1\d{10}$/.test(phone)) { showToast('请输入正确的11位手机号', 'err'); return; }
  if (!code) { showToast('请输入短信验证码', 'err'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '登录中...'; }
  fetch('/api/phone-login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({phone: phone, code: code}) })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.ok) {
        showToast(d.message || '登录成功，已添加账号');
        setTimeout(function(){ location.reload(); }, 900);
      } else {
        showToast(d.message || '登录失败', 'err');
      }
    })
    .catch(function(){ showToast('登录失败，请检查网络', 'err'); })
    .finally(function(){ if (btn) { btn.disabled = false; btn.textContent = '登录并添加账号'; } });
}
function saveAccounts() {
  var rows = document.querySelectorAll('#accList .acc-row');
  var list = [];
  rows.forEach(function(row) {
    var idx = row.getAttribute('data-idx');
    var name = document.getElementById('acc_name_'+idx);
    var uid = document.getElementById('acc_uid_'+idx);
    var token = document.getElementById('acc_token_'+idx);
    var bark = document.getElementById('acc_bark_'+idx);
    if (token && token.value.trim()) {
      list.push({ userName: name ? name.value : '', userId: uid ? uid.value : '', token: token.value.trim(), barkKey: bark ? bark.value.trim() : '', userAgent: '' });
    }
  });
  fetch('/api/save-accounts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({accounts: list}) })
    .then(function(r){ return r.json(); })
    .then(function(d){ if(d.ok){ showToast('极核账号已保存'); setTimeout(function(){ location.reload(); }, 800); } else { showToast('保存失败', 'err'); } })
    .catch(function(){ showToast('保存失败', 'err'); });
}

</script>
<div style="text-align:center;padding:16px;font-size:10px;color:#CBD5E1">脚本版本 ${SCRIPT_VERSION} · 极核 ZEEHO</div>
</body></html>`;
}

// ========== 响应辅助（兼容 QX / Loon / Surge） ==========
function sendResp(status, headers, body) {
  // Loon 专用：$done 使用 response 包装
  // 强制 no-cache：面板 HTML 每次访问都拉取最新版本，避免浏览器缓存旧界面导致新功能不生效
  const h = Object.assign({}, headers || {}, {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  });
  $done({ response: { status: status, headers: h, body: body } });
}
// ========== 主入口：重写路由 ==========
// ========== 整合版：极核 ZEEHO LITE 轻应用界面（base64 内嵌） ==========
const __APP_HTML_B64 = "PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9InpoLUNOIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9IlVURi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLCBtYXhpbXVtLXNjYWxlPTEsIHVzZXItc2NhbGFibGU9bm8sIHZpZXdwb3J0LWZpdD1jb3ZlciI+CjxtZXRhIG5hbWU9ImFwcGxlLW1vYmlsZS13ZWItYXBwLWNhcGFibGUiIGNvbnRlbnQ9InllcyI+CjxtZXRhIG5hbWU9Im1vYmlsZS13ZWItYXBwLWNhcGFibGUiIGNvbnRlbnQ9InllcyI+CjxtZXRhIG5hbWU9ImFwcGxlLW1vYmlsZS13ZWItYXBwLXN0YXR1cy1iYXItc3R5bGUiIGNvbnRlbnQ9ImJsYWNrLXRyYW5zbHVjZW50Ij4KPG1ldGEgbmFtZT0iYXBwbGUtbW9iaWxlLXdlYi1hcHAtdGl0bGUiIGNvbnRlbnQ9IuaegeaguOmdouadvyI+CjxtZXRhIG5hbWU9InRoZW1lLWNvbG9yIiBjb250ZW50PSIjMEEwRjFFIj4KPGxpbmsgcmVsPSJpY29uIiBocmVmPSJkYXRhOmltYWdlL3N2Zyt4bWwsJTNDc3ZnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zycgdmlld0JveD0nMCAwIDY0IDY0JyUzRSUzQ3JlY3Qgd2lkdGg9JzY0JyBoZWlnaHQ9JzY0JyByeD0nMTYnIGZpbGw9JyUyMzBBMEYxRScvJTNFJTNDcGF0aCBkPSdNMTQgMzhjMC0xMCA4LTE4IDE4LTE4czE4IDggMTggMTgnIGZpbGw9J25vbmUnIHN0cm9rZT0nJTIzMkJENEYyJyBzdHJva2Utd2lkdGg9JzYnIHN0cm9rZS1saW5lY2FwPSdyb3VuZCcvJTNFJTNDcGF0aCBkPSdNMzIgMzZsMTYgMTMnIHN0cm9rZT0nJTIzMEU4RkIyJyBzdHJva2Utd2lkdGg9JzYnIHN0cm9rZS1saW5lY2FwPSdyb3VuZCcvJTNFJTNDY2lyY2xlIGN4PScyMScgY3k9JzQ0JyByPSc1JyBmaWxsPSclMjMyQkQ0RjInLyUzRSUzQ2NpcmNsZSBjeD0nNDQnIGN5PSc0OCcgcj0nNScgZmlsbD0nJTIzMEU4RkIyJy8lM0UlM0Mvc3ZnJTNFIj4KPGxpbmsgcmVsPSJhcHBsZS10b3VjaC1pY29uIiBocmVmPSJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUxRQUFBQzBDQUlBQUFDeXI1RmxBQUFFYjBsRVFWUjRuTzNkd1hIVk1CU0ZZWWZKaWcwZE1NT2VEbWdwUmJ3aTBoSWRzS2VSTEZpSVNVenlqckV0V1RyMzZ2L1d6S0JuL2I3V09PSHg4UG5MMXdXNDU5UG9CY0FYY1VBaURrakVBWWs0SUJFSEpPS0FSQnlRaUFNU2NVQWlEa2pFQVlrNElCRUhKT0tBUkJ5UWlBTVNjVUFpRGtqRUFZazRJQkVISk9LQVJCeVFpQU1TY1VBaURrakVBWWs0SUQyT1hzQXczMzcrMnYrSGYvLzRmdDFLYkQzTTh4VU1oMnJZTmtrcitlTm8yTVJIdVN0Skc4ZWxUWHlVc3BLRWNYVE9ZaTFaSXFuaUdKakZXcHBFa3NSaGtzVmFna1RDeDJHWXhWcm9SR0svQkRNdlk0bXd3ZzFSSjBlNGl4NXhoSVNjSE9IS1dHS3VPVjRjRWE5eUVXN2xrUjRyNFM2dUV1VVJFMlp5cENsamlmTlpZc1FSNVdydUYrSVRCWWdqeEhVOHdmOXp1Y2ZoZndWcm1IODY2d05waDJ2MzM3T2h3eHBHbWZFM3dRNXR4dm9QbTkvb3pmbE9qdVk3MGZBR2RWNWJRNlp4UlBtVnZpanJQTWZ4UUJyb2lqdFBvM3Bwenh6ZGJzVHlGeGx1YlQyN3lkSGtLdmNmMFUzK1JyZkN2TTRjOVZkbitKTTd3VWQ0WlRjNWFqaGNWb2MxdEdJVVIrVTk1N01ybFN2eGViZ1l4VkhEcDR6Q2JUM251TVJSYzd0NDdrVE5xa3lHaDBzY3AzbVdVVGl2YlErTE9FeHVGQ3NPMThRaWp0UDhiMDMvRlc0WUg4ZnBXeVRLZFQrOXp1SERZM3djc0JVMWppaGpvNGkxMmxlRDR6ZzNPU05lNjNOckh2dGtpVG81MEFGeFFCb1p4enpQbENMY2s0WEpBWWs0SUFXTEkrNHpwWWkxL21CeG9LZGhjUXgvTnh6SXFHdkY1SUFVS1k1WUQyd2wwS2VJRkFjNkl3NUl4QUdKT0NBUkJ5U3ZmdzRKSzB3T1NNUUJpVGdnRVFjazRvQkVISkNJQXhKeFFDSU9TTVFCaVRnZ0VRY2s0b0JFSEZzZWI4K2psekFTY1VpbGpKbjdJSTc3MWsxTTJ3ZHg3UEo0ZTU0d0VlSzRRM1V3V3gvRThkNTJBVlAxUVJ6LzJMUDM4L1JCSEcvMjcvb2tmZkRiNTMrZDIrK1gyMVB6bGZoZ2NsVEpQVUtJWTFucTlqaHhIOFRSWUhlejlqRjdISzMyTldVZkhFZ2I3MnVtSStyc2syTnB2WjJaUmdpVDQwM0RmYzB4UDVnY2J4cnVhSTc1RVd4eXZQdlN4U3UrZkkzNThTcE1IQnZmeGRrOEVZNm9SWXpIeXZhM3REYi9EbGVPcUVXQXliRno3M25FTk9jK09mWlBoU3UrQTNyeUk2cDdITU8xN1NOV0l0WnhIQjBHRjMyQi9MUkhFT3M0Zk16WkIzSHM5WEo3bXUwSVFoekhUTlVIY1J3Mnp4SFZPbzZqcnk2Ni9WY21reHhCck9Od05rTWZ2Q0d0bGZndGFvREpzV2ZYQi83ZldJbVBxQUVtUjlIenA3SW5wUHhCYnBnNGlnNi96M0Zhdmo2Q3hlRXYweEVrd0pramxreEhFT0pvTDAwZlBGYXVrdUFJd3VTNFNvSzNaRXlPeThVOW9qSTV3dWovWkNHT0dEaHo1RlMvcjZOZWVCQUhKT0xvb2ViV0gvaWVsRGc2T2JmSFk5K2dFMGMvUjNkNitNOVdlTTh4d0o0M0g4UExXSWhqdUx1aE9KU3g4RmdacnUwL2gybUxPQ3lzKy9CcGhUaGNsQ1o4eWxnNGMyQURrd01TY1VBaURrakVBWWs0SUJFSEpPS0FSQnlRaUFNU2NVQWlEa2pFQVlrNElCRUhKT0tBUkJ5UWlBTVNjVUFpRGtqRUFZazRJQkVISk9LQVJCeVFpQU1TY1VBaURrakVBWWs0SUJFSEpPS0FSQnlRL2dDU2tWZGk1QkJ4aGdBQUFBQkpSVTVFcmtKZ2dnPT0iPgo8dGl0bGU+5p6B5qC4IFpFRUhPIOmdouadvzwvdGl0bGU+CjxzdHlsZT4KLyogPT09PT09PT09PT09IHJlc2V0ICYgdG9rZW5zID09PT09PT09PT09PSAqLwoqe21hcmdpbjowO3BhZGRpbmc6MDtib3gtc2l6aW5nOmJvcmRlci1ib3g7LXdlYmtpdC10YXAtaGlnaGxpZ2h0LWNvbG9yOnRyYW5zcGFyZW50fQo6cm9vdHsKICAtLWJnOiMwQTBGMUU7IC0tYmcyOiMwQzEzMjQ7CiAgLS1jYXJkOnJnYmEoMTQ2LDE3MCwyMDUsLjA1NSk7IC0tY2FyZDI6IzExMUEyRTsgLS1jYXJkMzojMEUxNjI4OwogIC0tbGluZTpyZ2JhKDE0NiwxNzAsMjA1LC4xMyk7IC0tbGluZTI6cmdiYSgxNDYsMTcwLDIwNSwuMjIpOwogIC0tdHh0OiNFQUYxRkI7IC0tdHh0MjojOTNBMEI4OyAtLXR4dDM6IzVFNkU4ODsKICAtLWJyYW5kOiMyQkQ0RjI7IC0tYnJhbmQyOiMwRThGQjI7IC0tYnJhbmRTb2Z0OnJnYmEoNDMsMjEyLDI0MiwuMTMpOwogIC0tb2s6IzNEREM5NzsgLS1va1NvZnQ6cmdiYSg2MSwyMjAsMTUxLC4xNCk7CiAgLS13YXJuOiNGN0I5NTU7IC0td2FyblNvZnQ6cmdiYSgyNDcsMTg1LDg1LC4xNCk7CiAgLS1lcnI6I0Y5NzA2QTsgLS1lcnJTb2Z0OnJnYmEoMjQ5LDExMiwxMDYsLjE0KTsKICAtLXZpbzojQjdBNkZCOyAtLXZpb1NvZnQ6cmdiYSgxODMsMTY2LDI1MSwuMTQpOwogIC0tZ3JhZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCMyQkQ0RjIsIzBFOEZCMik7CiAgLS1ncmFkLXZpbzpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCNCN0E2RkIsIzdDNkJGMCk7CiAgLS1yLWxnOjIycHg7IC0tci1tZDoxNnB4OyAtLXItc206MTJweDsKICAtLXNwcmluZzpjdWJpYy1iZXppZXIoLjMyLDEuNCwuNDQsMSk7CiAgLS1lYXNlOmN1YmljLWJlemllciguNCwwLC4yLDEpOwogIC0tc2FmZS10OmVudihzYWZlLWFyZWEtaW5zZXQtdG9wLDBweCk7CiAgLS1zYWZlLWI6ZW52KHNhZmUtYXJlYS1pbnNldC1ib3R0b20sMHB4KTsKfQpbZGF0YS10aGVtZT0ibGlnaHQiXXstLWJnOiNGM0Y2RkI7LS1iZzI6I0ZGRkZGRjstLWNhcmQ6cmdiYSgxNSwyMyw0MiwuMDQ1KTstLWNhcmQyOiNGRkZGRkY7LS1jYXJkMzojRURGMUY3Oy0tbGluZTpyZ2JhKDE1LDIzLDQyLC4xMCk7LS1saW5lMjpyZ2JhKDE1LDIzLDQyLC4xOCk7LS10eHQ6IzBGMTcyQTstLXR4dDI6IzQ3NTU2OTstLXR4dDM6Izk0QTNCODstLWJyYW5kOiMwRThGQjI7LS1icmFuZDI6IzJCRDRGMjstLWJyYW5kU29mdDpyZ2JhKDQzLDIxMiwyNDIsLjE2KTstLW9rOiMxNkEzNEE7LS1va1NvZnQ6cmdiYSgyMiwxNjMsNzQsLjE0KTstLXdhcm46I0Q5NzcwNjstLXdhcm5Tb2Z0OnJnYmEoMjE3LDExOSw2LC4xNik7LS1lcnI6I0RDMjYyNjstLWVyclNvZnQ6cmdiYSgyMjAsMzgsMzgsLjEyKTstLXZpbzojN0M2QkYwOy0tdmlvU29mdDpyZ2JhKDEyNCwxMDcsMjQwLC4xNCk7LS1ncmFkOmxpbmVhci1ncmFkaWVudCgxMzVkZWcsIzBFOEZCMiwjMkJENEYyKTstLWdyYWQtdmlvOmxpbmVhci1ncmFkaWVudCgxMzVkZWcsIzdDNkJGMCwjQjdBNkZCKX0KW2RhdGEtdGhlbWU9ImdyZWVuIl17LS1iZzojMDcxNDBFOy0tYmcyOiMwODE4MEY7LS1jYXJkOnJnYmEoODAsMjAwLDEyMCwuMDYpOy0tY2FyZDI6IzBDMUYxNTstLWNhcmQzOiMwOTFBMTI7LS1saW5lOnJnYmEoODAsMjAwLDEyMCwuMTQpOy0tbGluZTI6cmdiYSg4MCwyMDAsMTIwLC4yNCk7LS10eHQ6I0U2RjdFQzstLXR4dDI6IzhGQkZBMzstLXR4dDM6IzVFOEE2RTstLWJyYW5kOiMzNEQzOTk7LS1icmFuZDI6IzA1OTY2OTstLWJyYW5kU29mdDpyZ2JhKDUyLDIxMSwxNTMsLjE2KTstLW9rOiM0QURFODA7LS1va1NvZnQ6cmdiYSg3NCwyMjIsMTI4LC4xNik7LS13YXJuOiNGQkJGMjQ7LS13YXJuU29mdDpyZ2JhKDI1MSwxOTEsMzYsLjE2KTstLWVycjojRjg3MTcxOy0tZXJyU29mdDpyZ2JhKDI0OCwxMTMsMTEzLC4xNik7LS12aW86I0E3RjNEMDstLXZpb1NvZnQ6cmdiYSgxNjcsMjQzLDIwOCwuMTQpOy0tZ3JhZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCMzNEQzOTksIzA1OTY2OSk7LS1ncmFkLXZpbzpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCNBN0YzRDAsIzM0RDM5OSl9CltkYXRhLXRoZW1lPSJ2aW9sZXQiXXstLWJnOiMxMDBCMjA7LS1iZzI6IzE0MEQyODstLWNhcmQ6cmdiYSgxNTAsMTIwLDI1NSwuMDcpOy0tY2FyZDI6IzFBMTIzMzstLWNhcmQzOiMxNDEwMzA7LS1saW5lOnJnYmEoMTUwLDEyMCwyNTUsLjE1KTstLWxpbmUyOnJnYmEoMTUwLDEyMCwyNTUsLjI1KTstLXR4dDojRjBFQkZGOy0tdHh0MjojQjBBNkQ5Oy0tdHh0MzojN0E2RkE4Oy0tYnJhbmQ6I0E3OEJGQTstLWJyYW5kMjojN0MzQUVEOy0tYnJhbmRTb2Z0OnJnYmEoMTY3LDEzOSwyNTAsLjE4KTstLW9rOiM0QURFODA7LS1va1NvZnQ6cmdiYSg3NCwyMjIsMTI4LC4xNik7LS13YXJuOiNGQkJGMjQ7LS13YXJuU29mdDpyZ2JhKDI1MSwxOTEsMzYsLjE2KTstLWVycjojRjg3MTcxOy0tZXJyU29mdDpyZ2JhKDI0OCwxMTMsMTEzLC4xNik7LS12aW86I0M0QjVGRDstLXZpb1NvZnQ6cmdiYSgxOTYsMTgxLDI1MywuMTYpOy0tZ3JhZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCNBNzhCRkEsIzdDM0FFRCk7LS1ncmFkLXZpbzpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCNDNEI1RkQsI0E3OEJGQSl9CltkYXRhLXRoZW1lPSJhbWJlciJdey0tYmc6IzE2MTAwOTstLWJnMjojMUExMzBBOy0tY2FyZDpyZ2JhKDI1NSwxODAsOTAsLjA3KTstLWNhcmQyOiMyNDFBMEQ7LS1jYXJkMzojMUMxNTBCOy0tbGluZTpyZ2JhKDI1NSwxODAsOTAsLjE1KTstLWxpbmUyOnJnYmEoMjU1LDE4MCw5MCwuMjUpOy0tdHh0OiNGREYzRTM7LS10eHQyOiNEOUI5OEM7LS10eHQzOiNBOTgzNTQ7LS1icmFuZDojRkJCRjI0Oy0tYnJhbmQyOiNEOTc3MDY7LS1icmFuZFNvZnQ6cmdiYSgyNTEsMTkxLDM2LC4xOCk7LS1vazojNEFERTgwOy0tb2tTb2Z0OnJnYmEoNzQsMjIyLDEyOCwuMTYpOy0td2FybjojRjU5RTBCOy0td2FyblNvZnQ6cmdiYSgyNDUsMTU4LDExLC4xOCk7LS1lcnI6I0Y4NzE3MTstLWVyclNvZnQ6cmdiYSgyNDgsMTEzLDExMywuMTYpOy0tdmlvOiNGQ0QzNEQ7LS12aW9Tb2Z0OnJnYmEoMjUyLDIxMSw3NywuMTYpOy0tZ3JhZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCNGQkJGMjQsI0Q5NzcwNik7LS1ncmFkLXZpbzpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCNGQ0QzNEQsI0ZCQkYyNCl9CgoKLnZlaC1zd2l0Y2h7ZGlzcGxheTpmbGV4O2ZsZXgtd3JhcDp3cmFwO2dhcDo2cHg7YWxpZ24taXRlbXM6Y2VudGVyO21hcmdpbjoxMnB4IDAgNHB4fS52ZWgtc3ctbGFiZWx7Zm9udC1zaXplOjExcHg7Y29sb3I6dmFyKC0tdHh0Myk7bWFyZ2luLXJpZ2h0OjJweH0udmVoLWNoaXB7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMik7YmFja2dyb3VuZDp2YXIoLS1jYXJkMyk7Y29sb3I6dmFyKC0tdHh0Mik7Ym9yZGVyLXJhZGl1czoyMHB4O3BhZGRpbmc6NXB4IDExcHg7Zm9udC1zaXplOjEycHg7Y3Vyc29yOnBvaW50ZXJ9LnZlaC1jaGlwLm9ue2JhY2tncm91bmQ6dmFyKC0tYnJhbmRTb2Z0KTtib3JkZXItY29sb3I6dmFyKC0tYnJhbmQpO2NvbG9yOnZhcigtLWJyYW5kKX0udGhlbWUtZmFie3Bvc2l0aW9uOmZpeGVkO3RvcDoxNHB4O3JpZ2h0OjE0cHg7ei1pbmRleDo5OTk7d2lkdGg6NDBweDtoZWlnaHQ6NDBweDtib3JkZXItcmFkaXVzOjUwJTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUyKTtiYWNrZ3JvdW5kOnZhcigtLWNhcmQyKTtjb2xvcjp2YXIoLS10eHQpO2ZvbnQtc2l6ZToxOHB4O2N1cnNvcjpwb2ludGVyO2JveC1zaGFkb3c6MCA0cHggMTRweCByZ2JhKDAsMCwwLC4yOCl9CgpodG1sLGJvZHl7aGVpZ2h0OjEwMCV9CmJvZHl7CiAgZm9udC1mYW1pbHk6LWFwcGxlLXN5c3RlbSxCbGlua01hY1N5c3RlbUZvbnQsIlBpbmdGYW5nIFNDIiwiSGVsdmV0aWNhIE5ldWUiLCJTZWdvZSBVSSIsc2Fucy1zZXJpZjsKICBiYWNrZ3JvdW5kOnZhcigtLWJnKTsgY29sb3I6dmFyKC0tdHh0KTsgZm9udC1zaXplOjE1cHg7IGxpbmUtaGVpZ2h0OjEuNTsKICAtd2Via2l0LWZvbnQtc21vb3RoaW5nOmFudGlhbGlhc2VkOyBvdmVyc2Nyb2xsLWJlaGF2aW9yLXk6bm9uZTsKICAtd2Via2l0LXRleHQtc2l6ZS1hZGp1c3Q6MTAwJTsKfQoubnVte2ZvbnQtdmFyaWFudC1udW1lcmljOnRhYnVsYXItbnVtcztmb250LWZlYXR1cmUtc2V0dGluZ3M6InRudW0ifQpidXR0b257Zm9udC1mYW1pbHk6aW5oZXJpdDtjb2xvcjppbmhlcml0O2JhY2tncm91bmQ6bm9uZTtib3JkZXI6bm9uZTtjdXJzb3I6cG9pbnRlcjt0b3VjaC1hY3Rpb246bWFuaXB1bGF0aW9uO3VzZXItc2VsZWN0Om5vbmU7LXdlYmtpdC11c2VyLXNlbGVjdDpub25lfQppbnB1dCxzZWxlY3QsdGV4dGFyZWF7Zm9udC1mYW1pbHk6aW5oZXJpdDtjb2xvcjp2YXIoLS10eHQpO2JhY2tncm91bmQ6dmFyKC0tY2FyZDMpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxMnB4O3BhZGRpbmc6MTFweCAxM3B4O2ZvbnQtc2l6ZToxNXB4O3dpZHRoOjEwMCU7b3V0bGluZTpub25lO3RyYW5zaXRpb246Ym9yZGVyLWNvbG9yIC4ycyxib3gtc2hhZG93IC4yczstd2Via2l0LWFwcGVhcmFuY2U6bm9uZTthcHBlYXJhbmNlOm5vbmV9CmlucHV0OmZvY3VzLHNlbGVjdDpmb2N1cyx0ZXh0YXJlYTpmb2N1c3tib3JkZXItY29sb3I6dmFyKC0tYnJhbmQpO2JveC1zaGFkb3c6MCAwIDAgM3B4IHZhcigtLWJyYW5kU29mdCl9CmlucHV0OjpwbGFjZWhvbGRlcix0ZXh0YXJlYTo6cGxhY2Vob2xkZXJ7Y29sb3I6dmFyKC0tdHh0Myl9CnN2Z3tkaXNwbGF5OmJsb2NrfQo6OnNlbGVjdGlvbntiYWNrZ3JvdW5kOnZhcigtLWJyYW5kU29mdCl9Cjo6LXdlYmtpdC1zY3JvbGxiYXJ7d2lkdGg6MDtoZWlnaHQ6MH0KCi8qID09PT09PT09PT09PSBhcHAgc2hlbGwgPT09PT09PT09PT09ICovCiNhcHB7bWluLWhlaWdodDoxMDAlO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW59Ci5iZy1nbG93e3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7cG9pbnRlci1ldmVudHM6bm9uZTt6LWluZGV4OjA7CiAgYmFja2dyb3VuZDoKICAgIHJhZGlhbC1ncmFkaWVudCg1MiUgMzglIGF0IDEyJSAtNiUsIHJnYmEoNDMsMjEyLDI0MiwuMTQpLCB0cmFuc3BhcmVudCA2MiUpLAogICAgcmFkaWFsLWdyYWRpZW50KDQ2JSAzNCUgYXQgOTIlIDYlLCByZ2JhKDE0LDE0MywxNzgsLjEyKSwgdHJhbnNwYXJlbnQgNjIlKSwKICAgIHJhZGlhbC1ncmFkaWVudCg2MCUgNDAlIGF0IDUwJSAxMTAlLCByZ2JhKDEyNCwxMDcsMjQwLC4wOCksIHRyYW5zcGFyZW50IDY1JSk7Cn0KaGVhZGVyLmFwcC1oZWFkZXJ7CiAgcG9zaXRpb246c3RpY2t5O3RvcDowO3otaW5kZXg6NjA7CiAgcGFkZGluZzpjYWxjKDEycHggKyB2YXIoLS1zYWZlLXQpKSAxOHB4IDEycHg7CiAgYmFja2dyb3VuZDpyZ2JhKDEwLDE1LDMwLC43OCk7LXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6Ymx1cigyMnB4KSBzYXR1cmF0ZSgxLjUpO2JhY2tkcm9wLWZpbHRlcjpibHVyKDIycHgpIHNhdHVyYXRlKDEuNSk7CiAgYm9yZGVyLWJvdHRvbToxcHggc29saWQgcmdiYSgxNDYsMTcwLDIwNSwuMDkpOwogIGRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEycHg7Cn0KLmJyYW5kLW1hcmt7d2lkdGg6MzhweDtoZWlnaHQ6MzhweDtib3JkZXItcmFkaXVzOjEycHg7YmFja2dyb3VuZDp2YXIoLS1ncmFkKTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7ZmxleC1zaHJpbms6MDtib3gtc2hhZG93OjAgNnB4IDE4cHggcmdiYSgxNCwxNDMsMTc4LC4zNSksaW5zZXQgMCAxcHggMCByZ2JhKDI1NSwyNTUsMjU1LC4yNSl9Ci5icmFuZC1tYXJrIHN2Z3t3aWR0aDoyMnB4O2hlaWdodDoyMnB4fQouYnJhbmQtdHh0e2ZsZXg6MTttaW4td2lkdGg6MH0KLmJyYW5kLXR4dCBoMXtmb250LXNpemU6MTZweDtmb250LXdlaWdodDo4MDA7bGV0dGVyLXNwYWNpbmc6LjJweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo3cHh9Ci5icmFuZC10eHQgcHtmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS10eHQzKTttYXJnaW4tdG9wOjFweH0KLnZlci1jaGlwe2ZvbnQtc2l6ZTo5cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOnZhcigtLWJyYW5kKTtiYWNrZ3JvdW5kOnZhcigtLWJyYW5kU29mdCk7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDQzLDIxMiwyNDIsLjIyKTtwYWRkaW5nOjFweCA2cHg7Ym9yZGVyLXJhZGl1czo2cHg7bGV0dGVyLXNwYWNpbmc6LjRweH0KLmhlYWQtYWN0aW9uc3tkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7ZmxleC1zaHJpbms6MH0KLmljb24tYnRue3dpZHRoOjM2cHg7aGVpZ2h0OjM2cHg7Ym9yZGVyLXJhZGl1czoxMXB4O2JhY2tncm91bmQ6dmFyKC0tY2FyZCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Y29sb3I6dmFyKC0tdHh0Mik7dHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjE4cyB2YXIoLS1zcHJpbmcpLGJhY2tncm91bmQgLjJzLGNvbG9yIC4yc30KLmljb24tYnRuOmFjdGl2ZXt0cmFuc2Zvcm06c2NhbGUoLjkpfQouaWNvbi1idG4gc3Zne3dpZHRoOjE3cHg7aGVpZ2h0OjE3cHh9Ci5pY29uLWJ0bi5wcmltYXJ5e2JhY2tncm91bmQ6dmFyKC0tZ3JhZCk7Y29sb3I6IzA0MTIxQztib3JkZXI6bm9uZX0KLmNvdW50LWNoaXB7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NnB4O2hlaWdodDozNnB4O3BhZGRpbmc6MCAxMnB4O2JvcmRlci1yYWRpdXM6MTFweDtiYWNrZ3JvdW5kOnZhcigtLWNhcmQpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOnZhcigtLXR4dDIpO21pbi13aWR0aDo5NnB4O2p1c3RpZnktY29udGVudDpjZW50ZXI7dHJhbnNpdGlvbjpib3JkZXItY29sb3IgLjJzfQouY291bnQtY2hpcC5vbntib3JkZXItY29sb3I6cmdiYSg0MywyMTIsMjQyLC40KTtjb2xvcjp2YXIoLS1icmFuZCk7YmFja2dyb3VuZDp2YXIoLS1icmFuZFNvZnQpfQouY291bnQtcmluZ3t3aWR0aDoxNHB4O2hlaWdodDoxNHB4O3Bvc2l0aW9uOnJlbGF0aXZlO2ZsZXgtc2hyaW5rOjB9Ci5jb3VudC1yaW5nIHN2Z3t0cmFuc2Zvcm06cm90YXRlKC05MGRlZyk7d2lkdGg6MTRweDtoZWlnaHQ6MTRweH0KLmNvdW50LXJpbmcgLnRyYWNre3N0cm9rZTpyZ2JhKDE0NiwxNzAsMjA1LC4xOCk7ZmlsbDpub25lO3N0cm9rZS13aWR0aDoyfQouY291bnQtcmluZyAuYXJje3N0cm9rZTp2YXIoLS1icmFuZCk7ZmlsbDpub25lO3N0cm9rZS13aWR0aDoyO3N0cm9rZS1saW5lY2FwOnJvdW5kO3RyYW5zaXRpb246c3Ryb2tlLWRhc2hvZmZzZXQgLjVzIGxpbmVhcn0KCm1haW57ZmxleDoxO3Bvc2l0aW9uOnJlbGF0aXZlO3otaW5kZXg6MTtwYWRkaW5nOjE0cHggMTZweCBjYWxjKDE1MHB4ICsgdmFyKC0tc2FmZS1iKSl9CgovKiA9PT09PT09PT09PT0gcHVsbCB0byByZWZyZXNoID09PT09PT09PT09PSAqLwoucHRyLXdyYXB7cG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVufQoucHRyLWluZGljYXRvcntoZWlnaHQ6MDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7b3ZlcmZsb3c6aGlkZGVuO3RyYW5zaXRpb246aGVpZ2h0IC4zcyB2YXIoLS1lYXNlKTtjb2xvcjp2YXIoLS10eHQzKTtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDB9Ci5wdHItaW5kaWNhdG9yIC5zcGlubmVye3dpZHRoOjIwcHg7aGVpZ2h0OjIwcHg7bWFyZ2luLXJpZ2h0OjhweDtib3JkZXI6MnB4IHNvbGlkIHZhcigtLWxpbmUyKTtib3JkZXItdG9wLWNvbG9yOnZhcigtLWJyYW5kKTtib3JkZXItcmFkaXVzOjUwJTthbmltYXRpb246c3BpbiAuOHMgbGluZWFyIGluZmluaXRlfQoucHRyLWluZGljYXRvci5wdWxsaW5nIC5zcGlubmVye2FuaW1hdGlvbjpub25lO2JvcmRlci10b3AtY29sb3I6dmFyKC0tYnJhbmQpfQpAa2V5ZnJhbWVzIHNwaW57dG97dHJhbnNmb3JtOnJvdGF0ZSgzNjBkZWcpfX0KCi8qID09PT09PT09PT09PSBoZXJvIHN1bW1hcnkgPT09PT09PT09PT09ICovCi5oZXJvewogIHBvc2l0aW9uOnJlbGF0aXZlO2JvcmRlci1yYWRpdXM6dmFyKC0tci1sZyk7cGFkZGluZzoxOHB4IDE4cHggMTZweDttYXJnaW4tYm90dG9tOjE2cHg7b3ZlcmZsb3c6aGlkZGVuOwogIGJhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZyxyZ2JhKDQzLDIxMiwyNDIsLjE0KSxyZ2JhKDE0LDE0MywxNzgsLjA1KSA1NSUsdHJhbnNwYXJlbnQpLHZhcigtLWNhcmQpOwogIGJvcmRlcjoxcHggc29saWQgcmdiYSg0MywyMTIsMjQyLC4xNik7Cn0KLmhlcm86OmFmdGVye2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7cmlnaHQ6LTYwcHg7dG9wOi03MHB4O3dpZHRoOjIyMHB4O2hlaWdodDoyMjBweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOnJhZGlhbC1ncmFkaWVudChjaXJjbGUscmdiYSg0MywyMTIsMjQyLC4xNiksdHJhbnNwYXJlbnQgNjUlKTtwb2ludGVyLWV2ZW50czpub25lfQouaGVyby10b3B7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmZsZXgtZW5kO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoxMnB4fQouaGVyby1zY29yZSAubGJse2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLXR4dDMpO2ZvbnQtd2VpZ2h0OjYwMDtsZXR0ZXItc3BhY2luZzoxcHh9Ci5oZXJvLXNjb3JlIC52YWx7Zm9udC1zaXplOjM4cHg7Zm9udC13ZWlnaHQ6OTAwO2xpbmUtaGVpZ2h0OjEuMTU7bGV0dGVyLXNwYWNpbmc6LS41cHg7YmFja2dyb3VuZDp2YXIoLS1ncmFkKTstd2Via2l0LWJhY2tncm91bmQtY2xpcDp0ZXh0O2JhY2tncm91bmQtY2xpcDp0ZXh0O2NvbG9yOnRyYW5zcGFyZW50O2ZvbnQtZmVhdHVyZS1zZXR0aW5nczoidG51bSJ9Ci5oZXJvLXNjb3JlIC52YWwgc21hbGx7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwfQouaGVyby1yaWdodHt0ZXh0LWFsaWduOnJpZ2h0O2ZsZXgtc2hyaW5rOjB9Ci5oZXJvLXJpZ2h0IC5iaWd7Zm9udC1zaXplOjIycHg7Zm9udC13ZWlnaHQ6OTAwO2NvbG9yOnZhcigtLW9rKX0KLmhlcm8tcmlnaHQgLmJpZyBzcGFue2ZvbnQtc2l6ZToxMnB4O2NvbG9yOnZhcigtLXR4dDMpO2ZvbnQtd2VpZ2h0OjYwMH0KLmhlcm8tcmlnaHQgLnN1Yntmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS10eHQzKTttYXJnaW4tdG9wOjJweH0KLmhlcm8tc3RhdHN7ZGlzcGxheTpmbGV4O2dhcDoxMHB4O21hcmdpbi10b3A6MTRweH0KLmhzdGF0e2ZsZXg6MTtiYWNrZ3JvdW5kOnJnYmEoMTAsMTUsMzAsLjUpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxNHB4O3BhZGRpbmc6OXB4IDEycHh9Ci5oc3RhdCAudntmb250LXNpemU6MTdweDtmb250LXdlaWdodDo4MDA7Zm9udC1mZWF0dXJlLXNldHRpbmdzOiJ0bnVtIn0KLmhzdGF0IC5se2ZvbnQtc2l6ZToxMHB4O2NvbG9yOnZhcigtLXR4dDMpO21hcmdpbi10b3A6MXB4O2ZvbnQtd2VpZ2h0OjYwMH0KLmhzdGF0LmFtYmVyIC52e2NvbG9yOnZhcigtLXdhcm4pfSAuaHN0YXQuY3lhbiAudntjb2xvcjp2YXIoLS1icmFuZCl9IC5oc3RhdC5ncmVlbiAudntjb2xvcjp2YXIoLS1vayl9CgovKiA9PT09PT09PT09PT0gYnV0dG9ucyAmIGNoaXBzID09PT09PT09PT09PSAqLwouZmFiewogIHBvc2l0aW9uOmZpeGVkO3JpZ2h0OjE2cHg7Ym90dG9tOmNhbGMoMTAwcHggKyB2YXIoLS1zYWZlLWIpKTt6LWluZGV4OjUwOwogIGRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjdweDtoZWlnaHQ6NDZweDtwYWRkaW5nOjAgMTZweDtib3JkZXItcmFkaXVzOjIzcHg7CiAgYmFja2dyb3VuZDp2YXIoLS1ncmFkKTtjb2xvcjojMDQxMjFDO2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjgwMDtsZXR0ZXItc3BhY2luZzouM3B4OwogIGJveC1zaGFkb3c6MCAxMHB4IDI4cHggcmdiYSgxNCwxNDMsMTc4LC40NSksaW5zZXQgMCAxcHggMCByZ2JhKDI1NSwyNTUsMjU1LC4zKTsKICB0cmFuc2l0aW9uOnRyYW5zZm9ybSAuMnMgdmFyKC0tc3ByaW5nKSxib3gtc2hhZG93IC4yczthbmltYXRpb246ZmFiLWluIC41cyB2YXIoLS1zcHJpbmcpIGJvdGg7Cn0KLmZhYjphY3RpdmV7dHJhbnNmb3JtOnNjYWxlKC45NCl9Ci5mYWIgc3Zne3dpZHRoOjE3cHg7aGVpZ2h0OjE3cHh9CkBrZXlmcmFtZXMgZmFiLWlue2Zyb217dHJhbnNmb3JtOnRyYW5zbGF0ZVkoMjRweCk7b3BhY2l0eTowfXRve3RyYW5zZm9ybTp0cmFuc2xhdGVZKDApO29wYWNpdHk6MX19Ci5idG57CiAgZGlzcGxheTppbmxpbmUtZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtnYXA6NnB4O2hlaWdodDo0MHB4O3BhZGRpbmc6MCAxOHB4O2JvcmRlci1yYWRpdXM6MTNweDsKICBmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDA7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtiYWNrZ3JvdW5kOnZhcigtLWNhcmQpO2NvbG9yOnZhcigtLXR4dCk7CiAgdHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjE2cyB2YXIoLS1zcHJpbmcpLGJhY2tncm91bmQgLjJzLGJvcmRlci1jb2xvciAuMnM7Cn0KLmJ0bjphY3RpdmV7dHJhbnNmb3JtOnNjYWxlKC45Nil9Ci5idG4ucHJpbWFyeXtiYWNrZ3JvdW5kOnZhcigtLWdyYWQpO2NvbG9yOiMwNDEyMUM7Ym9yZGVyOm5vbmV9Ci5idG4uZ2hvc3R7YmFja2dyb3VuZDp0cmFuc3BhcmVudDtjb2xvcjp2YXIoLS10eHQyKX0KLmJ0bi5kYW5nZXJ7YmFja2dyb3VuZDp2YXIoLS1lcnJTb2Z0KTtjb2xvcjp2YXIoLS1lcnIpO2JvcmRlci1jb2xvcjpyZ2JhKDI0OSwxMTIsMTA2LC4yOCl9Ci5idG4uc217aGVpZ2h0OjMycHg7cGFkZGluZzowIDEycHg7Zm9udC1zaXplOjEycHg7Ym9yZGVyLXJhZGl1czoxMHB4fQouYnRuOmRpc2FibGVke29wYWNpdHk6LjU7cG9pbnRlci1ldmVudHM6bm9uZX0KLmNoaXB7ZGlzcGxheTppbmxpbmUtZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjVweDtoZWlnaHQ6MzBweDtwYWRkaW5nOjAgMTJweDtib3JkZXItcmFkaXVzOjE1cHg7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2JhY2tncm91bmQ6dmFyKC0tY2FyZCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtjb2xvcjp2YXIoLS10eHQyKTt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuMTZzIHZhcigtLXNwcmluZyl9Ci5jaGlwOmFjdGl2ZXt0cmFuc2Zvcm06c2NhbGUoLjk0KX0KLmNoaXAub257YmFja2dyb3VuZDp2YXIoLS1icmFuZFNvZnQpO2JvcmRlci1jb2xvcjpyZ2JhKDQzLDIxMiwyNDIsLjM1KTtjb2xvcjp2YXIoLS1icmFuZCl9Ci5jaGlwIC5kb3R7d2lkdGg6NnB4O2hlaWdodDo2cHg7Ym9yZGVyLXJhZGl1czo1MCU7YmFja2dyb3VuZDpjdXJyZW50Q29sb3J9Ci5waWxse2Rpc3BsYXk6aW5saW5lLWZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo1cHg7aGVpZ2h0OjI0cHg7cGFkZGluZzowIDEwcHg7Ym9yZGVyLXJhZGl1czoxMnB4O2ZvbnQtc2l6ZToxMXB4O2ZvbnQtd2VpZ2h0OjcwMDtmbGV4LXNocmluazowfQoucGlsbC5va3tiYWNrZ3JvdW5kOnZhcigtLW9rU29mdCk7Y29sb3I6dmFyKC0tb2spfQoucGlsbC5taXNze2JhY2tncm91bmQ6dmFyKC0tZXJyU29mdCk7Y29sb3I6dmFyKC0tZXJyKX0KLnBpbGwuY3lhbntiYWNrZ3JvdW5kOnZhcigtLWJyYW5kU29mdCk7Y29sb3I6dmFyKC0tYnJhbmQpfQoucGlsbC5ncmF5e2JhY2tncm91bmQ6cmdiYSgxNDYsMTcwLDIwNSwuMTIpO2NvbG9yOnZhcigtLXR4dDIpfQoucGlsbC52aW97YmFja2dyb3VuZDp2YXIoLS12aW9Tb2Z0KTtjb2xvcjp2YXIoLS12aW8pfQoucGlsbC5hbWJlcntiYWNrZ3JvdW5kOnZhcigtLXdhcm5Tb2Z0KTtjb2xvcjp2YXIoLS13YXJuKX0KCi8qID09PT09PT09PT09PSBhY2NvdW50IGNhcmRzID09PT09PT09PT09PSAqLwouc2VjdGlvbi10aXRsZXtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6ODAwO2NvbG9yOnZhcigtLXR4dDIpO21hcmdpbjo0cHggMnB4IDEycHg7bGV0dGVyLXNwYWNpbmc6LjVweH0KLnNlY3Rpb24tdGl0bGUgc3Zne3dpZHRoOjE1cHg7aGVpZ2h0OjE1cHg7Y29sb3I6dmFyKC0tYnJhbmQpfQouYWNjLWNhcmR7CiAgcG9zaXRpb246cmVsYXRpdmU7Ym9yZGVyLXJhZGl1czp2YXIoLS1yLWxnKTtwYWRkaW5nOjE2cHg7bWFyZ2luLWJvdHRvbToxNHB4O292ZXJmbG93OmhpZGRlbjsKICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxODBkZWcscmdiYSgxNDYsMTcwLDIwNSwuMDYpLHJnYmEoMTQ2LDE3MCwyMDUsLjAzKSksdmFyKC0tY2FyZCk7CiAgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTsKICBhbmltYXRpb246Y2FyZC1pbiAuNDVzIHZhcigtLWVhc2UpIGJvdGg7CiAgdHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjJzIHZhcigtLWVhc2UpOwp9Ci5hY2MtY2FyZC5lcnJvcntib3JkZXItY29sb3I6cmdiYSgyNDksMTEyLDEwNiwuNCk7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLHJnYmEoMjQ5LDExMiwxMDYsLjA3KSx0cmFuc3BhcmVudCksdmFyKC0tY2FyZCl9CkBrZXlmcmFtZXMgY2FyZC1pbntmcm9te29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWSgxNHB4KX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoMCl9fQouYWNjLWhlYWR7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTFweDttYXJnaW4tYm90dG9tOjE0cHh9Ci5hdmF0YXJ7d2lkdGg6NDJweDtoZWlnaHQ6NDJweDtib3JkZXItcmFkaXVzOjEzcHg7YmFja2dyb3VuZDp2YXIoLS1ncmFkKTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC13ZWlnaHQ6OTAwO2ZvbnQtc2l6ZToxN3B4O2NvbG9yOiMwNDEyMUM7ZmxleC1zaHJpbms6MDtib3gtc2hhZG93OjAgNHB4IDE0cHggcmdiYSgxNCwxNDMsMTc4LC4zKX0KLmF2YXRhci52aW97YmFja2dyb3VuZDp2YXIoLS1ncmFkLXZpbyk7Y29sb3I6IzE0MEYyRTtib3gtc2hhZG93OjAgNHB4IDE0cHggcmdiYSgxMjQsMTA3LDI0MCwuMyl9Ci5hY2MtaW5mb3tmbGV4OjE7bWluLXdpZHRoOjB9Ci5hY2MtbmFtZXtmb250LXNpemU6MTVweDtmb250LXdlaWdodDo4MDA7d2hpdGUtc3BhY2U6bm93cmFwO292ZXJmbG93OmhpZGRlbjt0ZXh0LW92ZXJmbG93OmVsbGlwc2lzfQouYWNjLXN1Yntmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS10eHQzKTttYXJnaW4tdG9wOjFweDtmb250LWZhbWlseTp1aS1tb25vc3BhY2UsU0ZNb25vLVJlZ3VsYXIsTWVubG8sbW9ub3NwYWNlfQouYWNjLWFjdGlvbnN7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6N3B4O2ZsZXgtc2hyaW5rOjB9Ci5hY2MtZXJye2ZvbnQtc2l6ZToxMnB4O2NvbG9yOnZhcigtLWVycik7YmFja2dyb3VuZDp2YXIoLS1lcnJTb2Z0KTtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzo4cHggMTFweDttYXJnaW4tYm90dG9tOjEycHg7Zm9udC13ZWlnaHQ6NjAwfQoua3BpLWdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNCwxZnIpO2dhcDo4cHg7bWFyZ2luLWJvdHRvbToxNHB4fQoua3Bpe2JhY2tncm91bmQ6cmdiYSgxMCwxNSwzMCwuNDUpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxNHB4O3BhZGRpbmc6OXB4IDJweDt0ZXh0LWFsaWduOmNlbnRlcn0KLmtwaSAudntmb250LXNpemU6MTdweDtmb250LXdlaWdodDo5MDA7Zm9udC1mZWF0dXJlLXNldHRpbmdzOiJ0bnVtIjtsaW5lLWhlaWdodDoxLjJ9Ci5rcGkgLmx7Zm9udC1zaXplOjkuNXB4O2NvbG9yOnZhcigtLXR4dDMpO2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tdG9wOjJweH0KLmtwaS5jMSAudntjb2xvcjp2YXIoLS10eHQpfSAua3BpLmMyIC52e2NvbG9yOnZhcigtLW9rKX0gLmtwaS5jMyAudntjb2xvcjp2YXIoLS1icmFuZCl9IC5rcGkuYzQgLnZ7Y29sb3I6dmFyKC0tdmlvKX0KLmJsaW5ke21hcmdpbi1ib3R0b206MTRweH0KLmJsaW5kLXRvcHtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLXR4dDIpO2ZvbnQtd2VpZ2h0OjcwMDttYXJnaW4tYm90dG9tOjZweH0KLmJsaW5kLXRvcCAucntjb2xvcjp2YXIoLS12aW8pO2ZvbnQtZmVhdHVyZS1zZXR0aW5nczoidG51bSJ9Ci5ibGluZC1iYXJ7aGVpZ2h0OjE0cHg7Ym9yZGVyLXJhZGl1czo4cHg7YmFja2dyb3VuZDpyZ2JhKDE0NiwxNzAsMjA1LC4xKTtvdmVyZmxvdzpoaWRkZW47Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKX0KLmJsaW5kLWZpbGx7aGVpZ2h0OjEwMCU7Ym9yZGVyLXJhZGl1czo4cHg7YmFja2dyb3VuZDp2YXIoLS1ncmFkLXZpbyk7dHJhbnNpdGlvbjp3aWR0aCAuN3MgdmFyKC0tZWFzZSk7Ym94LXNoYWRvdzowIDAgMTJweCByZ2JhKDEyNCwxMDcsMjQwLC41KX0KLndlZWt7bWFyZ2luLWJvdHRvbTo0cHh9Ci53ZWVrLXRvcHtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLXR4dDIpO2ZvbnQtd2VpZ2h0OjcwMDttYXJnaW4tYm90dG9tOjdweH0KLndlZWstZ3JpZHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCg3LDFmcik7Z2FwOjVweH0KLmRheXthc3BlY3QtcmF0aW86MTtib3JkZXItcmFkaXVzOjlweDtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2dhcDoxcHg7YmFja2dyb3VuZDpyZ2JhKDEwLDE1LDMwLC41KTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpfQouZGF5IC5ke2ZvbnQtc2l6ZTo5cHg7Y29sb3I6dmFyKC0tdHh0Myk7Zm9udC13ZWlnaHQ6NzAwO2xpbmUtaGVpZ2h0OjF9Ci5kYXkgLm17Zm9udC1zaXplOjhweDtsaW5lLWhlaWdodDoxfQouZGF5Lm9re2JhY2tncm91bmQ6dmFyKC0tYnJhbmRTb2Z0KTtib3JkZXItY29sb3I6cmdiYSg0MywyMTIsMjQyLC4zNSl9Ci5kYXkub2sgLmR7Y29sb3I6dmFyKC0tYnJhbmQpfQouZGF5LnRvZGF5e2JhY2tncm91bmQ6dmFyKC0tZ3JhZCk7Ym9yZGVyOm5vbmU7Ym94LXNoYWRvdzowIDRweCAxMnB4IHJnYmEoMTQsMTQzLDE3OCwuNCl9Ci5kYXkudG9kYXkgLmR7Y29sb3I6IzA0MTIxQ30KLmRheS50b2RheSAubXtjb2xvcjpyZ2JhKDQsMTgsMjgsLjcpfQoKLyogPT09PT09PT09PT09IHZlaGljbGUgc2VjdGlvbiA9PT09PT09PT09PT0gKi8KLnZlaGljbGV7CiAgbWFyZ2luLXRvcDoxNHB4O3BhZGRpbmctdG9wOjE0cHg7Ym9yZGVyLXRvcDoxcHggZGFzaGVkIHZhcigtLWxpbmUyKTtjdXJzb3I6cG9pbnRlcjsKfQoudmVoaWNsZS10b3B7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTJweDttYXJnaW4tYm90dG9tOjEzcHh9Ci52ZWhpY2xlLXJpbmd7cG9zaXRpb246cmVsYXRpdmU7d2lkdGg6NzRweDtoZWlnaHQ6NzRweDtmbGV4LXNocmluazowfQoudmVoaWNsZS1yaW5nIHN2Z3t3aWR0aDo3NHB4O2hlaWdodDo3NHB4O3RyYW5zZm9ybTpyb3RhdGUoLTkwZGVnKX0KLnZlaGljbGUtcmluZyAudHJhY2t7c3Ryb2tlOnJnYmEoMTQ2LDE3MCwyMDUsLjE0KTtmaWxsOm5vbmU7c3Ryb2tlLXdpZHRoOjV9Ci52ZWhpY2xlLXJpbmcgLmFyY3tmaWxsOm5vbmU7c3Ryb2tlLXdpZHRoOjU7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7dHJhbnNpdGlvbjpzdHJva2UtZGFzaG9mZnNldCAuOHMgdmFyKC0tZWFzZSksc3Ryb2tlIC41c30KLnZlaGljbGUtcmluZyAucGN0e3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2ZvbnQtc2l6ZToxN3B4O2ZvbnQtd2VpZ2h0OjkwMDtmb250LWZlYXR1cmUtc2V0dGluZ3M6InRudW0ifQoudmVoaWNsZS1tZXRhe2ZsZXg6MTttaW4td2lkdGg6MH0KLnZlaGljbGUtbmFtZXtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo4MDA7d2hpdGUtc3BhY2U6bm93cmFwO292ZXJmbG93OmhpZGRlbjt0ZXh0LW92ZXJmbG93OmVsbGlwc2lzfQoudmVoaWNsZS12aW57Zm9udC1zaXplOjEwcHg7Y29sb3I6dmFyKC0tdHh0Myk7bWFyZ2luLXRvcDoycHg7Zm9udC1mYW1pbHk6dWktbW9ub3NwYWNlLFNGTW9uby1SZWd1bGFyLE1lbmxvLG1vbm9zcGFjZX0KLnZpbi1zaG93e2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjp2YXIoLS1icmFuZCk7bWFyZ2luLWxlZnQ6NHB4O3BhZGRpbmc6MXB4IDZweDtib3JkZXItcmFkaXVzOjVweDtiYWNrZ3JvdW5kOnZhcigtLWJyYW5kU29mdCl9Ci52ZWhpY2xlLWJhZGdlc3tkaXNwbGF5OmZsZXg7Z2FwOjVweDttYXJnaW4tdG9wOjdweDtmbGV4LXdyYXA6d3JhcH0KLnZzdGF0LXJvd3tkaXNwbGF5OmZsZXg7Z2FwOjZweDtmbGV4LXdyYXA6d3JhcDttYXJnaW4tYm90dG9tOjEycHh9Ci52c3RhdHtkaXNwbGF5OmlubGluZS1mbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NXB4O2hlaWdodDoyNnB4O3BhZGRpbmc6MCAxMXB4O2JvcmRlci1yYWRpdXM6MTNweDtmb250LXNpemU6MTFweDtmb250LXdlaWdodDo3MDB9Ci52c3RhdCBzdmd7d2lkdGg6MTJweDtoZWlnaHQ6MTJweH0KLnZzdGF0Lm9ue2JhY2tncm91bmQ6dmFyKC0tb2tTb2Z0KTtjb2xvcjp2YXIoLS1vayl9Ci52c3RhdC5vZmZ7YmFja2dyb3VuZDpyZ2JhKDE0NiwxNzAsMjA1LC4xKTtjb2xvcjp2YXIoLS10eHQyKX0KLnZzdGF0LmxvY2tlZHtiYWNrZ3JvdW5kOnZhcigtLWVyclNvZnQpO2NvbG9yOnZhcigtLWVycil9Ci52c3RhdC51bmxvY2tlZHtiYWNrZ3JvdW5kOnZhcigtLW9rU29mdCk7Y29sb3I6dmFyKC0tb2spfQoudnN0YXQuc2VhdHtiYWNrZ3JvdW5kOnZhcigtLXZpb1NvZnQpO2NvbG9yOnZhcigtLXZpbyl9Ci5jaGFyZ2UtYmFubmVye2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjlweDtiYWNrZ3JvdW5kOnZhcigtLW9rU29mdCk7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDYxLDIyMCwxNTEsLjI1KTtib3JkZXItcmFkaXVzOjEycHg7cGFkZGluZzo5cHggMTJweDttYXJnaW4tYm90dG9tOjEycHh9Ci5jaGFyZ2UtYmFubmVyIHN2Z3t3aWR0aDoxNXB4O2hlaWdodDoxNXB4O2NvbG9yOnZhcigtLW9rKTtmbGV4LXNocmluazowfQouY2hhcmdlLWJhbm5lciAuY3R7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6ODAwO2NvbG9yOnZhcigtLW9rKX0KLmNoYXJnZS1iYW5uZXIgLmNle2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLW9rKTtvcGFjaXR5Oi44NTttYXJnaW4tbGVmdDphdXRvO2JhY2tncm91bmQ6cmdiYSg2MSwyMjAsMTUxLC4xNSk7cGFkZGluZzoycHggOXB4O2JvcmRlci1yYWRpdXM6MTBweH0KLnZrcGktZ3JpZHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCg0LDFmcik7Z2FwOjdweDttYXJnaW4tYm90dG9tOjEycHh9Ci52a3Bpe2JhY2tncm91bmQ6cmdiYSgxMCwxNSwzMCwuNDUpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxMnB4O3BhZGRpbmc6OHB4IDJweDt0ZXh0LWFsaWduOmNlbnRlcn0KLnZrcGkgLnZ7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6OTAwO2ZvbnQtZmVhdHVyZS1zZXR0aW5nczoidG51bSJ9Ci52a3BpIC5se2ZvbnQtc2l6ZTo5cHg7Y29sb3I6dmFyKC0tdHh0Myk7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbi10b3A6MnB4fQouYmF0dC10cmFja3toZWlnaHQ6OXB4O2JvcmRlci1yYWRpdXM6NXB4O2JhY2tncm91bmQ6cmdiYSgxNDYsMTcwLDIwNSwuMSk7b3ZlcmZsb3c6aGlkZGVuO21hcmdpbi1ib3R0b206MTJweDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpfQouYmF0dC1maWxse2hlaWdodDoxMDAlO2JvcmRlci1yYWRpdXM6NXB4O3RyYW5zaXRpb246d2lkdGggLjhzIHZhcigtLWVhc2UpLGJhY2tncm91bmQgLjVzO2JveC1zaGFkb3c6MCAwIDEwcHggY3VycmVudENvbG9yfQoubWV0YS1yb3d7ZGlzcGxheTpmbGV4O2dhcDo4cHg7ZmxleC13cmFwOndyYXA7bWFyZ2luLWJvdHRvbTo2cHh9Ci5tZXRhLWl0ZW17ZGlzcGxheTppbmxpbmUtZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjZweDtmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS10eHQyKTtiYWNrZ3JvdW5kOnJnYmEoMTAsMTUsMzAsLjQ1KTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6OXB4O3BhZGRpbmc6NXB4IDlweDtmb250LXdlaWdodDo2MDB9Ci5tZXRhLWl0ZW0gc3Zne3dpZHRoOjEycHg7aGVpZ2h0OjEycHg7Y29sb3I6dmFyKC0tYnJhbmQpfQoubWV0YS1pdGVtIGJ7Y29sb3I6dmFyKC0tdHh0KX0KLnZlaGljbGUtYWRkcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7bWFyZ2luLXRvcDo0cHg7bWFyZ2luLWJvdHRvbToxMHB4O2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLXR4dDMpfQoudmVoaWNsZS1hZGRyIC5hdHtmbGV4OjE7bWluLXdpZHRoOjA7d2hpdGUtc3BhY2U6bm93cmFwO292ZXJmbG93OmhpZGRlbjt0ZXh0LW92ZXJmbG93OmVsbGlwc2lzfQoudmVoaWNsZS1hZGRyIHN2Z3t3aWR0aDoxM3B4O2hlaWdodDoxM3B4O2NvbG9yOnZhcigtLXdhcm4pO2ZsZXgtc2hyaW5rOjB9Ci5tYXAtYnRue2hlaWdodDoyNnB4O3BhZGRpbmc6MCAxMXB4O2JvcmRlci1yYWRpdXM6MTNweDtmb250LXNpemU6MTFweDtmb250LXdlaWdodDo3MDA7YmFja2dyb3VuZDp2YXIoLS1icmFuZFNvZnQpO2NvbG9yOnZhcigtLWJyYW5kKTtib3JkZXI6MXB4IHNvbGlkIHJnYmEoNDMsMjEyLDI0MiwuMyk7ZmxleC1zaHJpbms6MDt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuMTZzIHZhcigtLXNwcmluZyl9Ci5tYXAtYnRuOmFjdGl2ZXt0cmFuc2Zvcm06c2NhbGUoLjk0KX0KLm1hcC1idG46ZGlzYWJsZWR7b3BhY2l0eTouNDU7cG9pbnRlci1ldmVudHM6bm9uZX0KLmN0cmwtZ3JpZHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCg1LDFmcik7Z2FwOjZweDtib3JkZXItdG9wOjFweCBkYXNoZWQgdmFyKC0tbGluZTIpO3BhZGRpbmctdG9wOjEycHh9Ci5jdHJsLWJ0bntkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NXB4O3BhZGRpbmc6MTBweCAycHg7Ym9yZGVyLXJhZGl1czoxM3B4O2JhY2tncm91bmQ6cmdiYSgxMCwxNSwzMCwuNSk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtmb250LXNpemU6MTAuNXB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjp2YXIoLS10eHQyKTt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuMTZzIHZhcigtLXNwcmluZyksYmFja2dyb3VuZCAuMnMsYm9yZGVyLWNvbG9yIC4ycyxjb2xvciAuMnN9Ci5jdHJsLWJ0biBzdmd7d2lkdGg6MTdweDtoZWlnaHQ6MTdweDtjb2xvcjp2YXIoLS10eHQyKTt0cmFuc2l0aW9uOmNvbG9yIC4yc30KLmN0cmwtYnRuOmFjdGl2ZXt0cmFuc2Zvcm06c2NhbGUoLjkyKX0KLmN0cmwtYnRuLnVubG9ja3tib3JkZXItY29sb3I6cmdiYSg2MSwyMjAsMTUxLC4zKTtjb2xvcjp2YXIoLS1vayl9Ci5jdHJsLWJ0bi51bmxvY2sgc3Zne2NvbG9yOnZhcigtLW9rKX0KLmN0cmwtYnRuLmxvY2t7Ym9yZGVyLWNvbG9yOnJnYmEoMjQ5LDExMiwxMDYsLjMpO2NvbG9yOnZhcigtLWVycil9Ci5jdHJsLWJ0bi5sb2NrIHN2Z3tjb2xvcjp2YXIoLS1lcnIpfQouY3RybC1idG46ZGlzYWJsZWR7b3BhY2l0eTouNTtwb2ludGVyLWV2ZW50czpub25lfQouY3RybC1idG4uYnVzeSBzdmd7YW5pbWF0aW9uOnNwaW4gLjhzIGxpbmVhciBpbmZpbml0ZX0KLm5vLXZlaGljbGV7cGFkZGluZzoxNHB4O2JvcmRlci1yYWRpdXM6MTRweDtiYWNrZ3JvdW5kOnZhcigtLXdhcm5Tb2Z0KTtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMjQ3LDE4NSw4NSwuMjUpO2NvbG9yOnZhcigtLXdhcm4pO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDt0ZXh0LWFsaWduOmNlbnRlcn0KCi8qID09PT09PT09PT09PSBlbXB0eSAmIHNrZWxldG9uID09PT09PT09PT09PSAqLwouZW1wdHl7cGFkZGluZzo3MHB4IDI2cHg7dGV4dC1hbGlnbjpjZW50ZXI7YW5pbWF0aW9uOmNhcmQtaW4gLjRzIHZhcigtLWVhc2UpIGJvdGh9Ci5lbXB0eSAuZS1pY29ue3dpZHRoOjc0cHg7aGVpZ2h0Ojc0cHg7bWFyZ2luOjAgYXV0byAxOHB4O2JvcmRlci1yYWRpdXM6MjRweDtiYWNrZ3JvdW5kOnZhcigtLWNhcmQpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2NvbG9yOnZhcigtLXR4dDMpfQouZW1wdHkgLmUtaWNvbiBzdmd7d2lkdGg6MzRweDtoZWlnaHQ6MzRweH0KLmVtcHR5IGgze2ZvbnQtc2l6ZToxN3B4O2ZvbnQtd2VpZ2h0OjgwMDttYXJnaW4tYm90dG9tOjZweH0KLmVtcHR5IHB7Zm9udC1zaXplOjEzcHg7Y29sb3I6dmFyKC0tdHh0Mik7bGluZS1oZWlnaHQ6MS43O21heC13aWR0aDozMDBweDttYXJnaW46MCBhdXRvIDIwcHh9Ci5za3tiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxMDBkZWcscmdiYSgxNDYsMTcwLDIwNSwuMDYpIDQwJSxyZ2JhKDE0NiwxNzAsMjA1LC4xMikgNTAlLHJnYmEoMTQ2LDE3MCwyMDUsLjA2KSA2MCUpO2JhY2tncm91bmQtc2l6ZToyMDAlIDEwMCU7YW5pbWF0aW9uOnNrIDEuMnMgbGluZWFyIGluZmluaXRlO2JvcmRlci1yYWRpdXM6MTBweH0KQGtleWZyYW1lcyBza3t0b3tiYWNrZ3JvdW5kLXBvc2l0aW9uOi0yMDAlIDB9fQouc2stY2FyZHtib3JkZXItcmFkaXVzOnZhcigtLXItbGcpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7cGFkZGluZzoxNnB4O21hcmdpbi1ib3R0b206MTRweDtiYWNrZ3JvdW5kOnZhcigtLWNhcmQpfQouc2stbGluZXtoZWlnaHQ6MTNweDttYXJnaW4tYm90dG9tOjEwcHh9LnNrLWxpbmUudzQwe3dpZHRoOjQwJX0uc2stbGluZS53NjB7d2lkdGg6NjAlfS5zay1saW5lLnc4MHt3aWR0aDo4MCV9Ci5zay1yb3d7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNCwxZnIpO2dhcDo4cHg7bWFyZ2luOjE0cHggMH0KLnNrLWNlbGx7aGVpZ2h0OjUycHg7Ym9yZGVyLXJhZGl1czoxMnB4fQouc2stYmFye2hlaWdodDoxNHB4O2JvcmRlci1yYWRpdXM6OHB4O21hcmdpbi10b3A6MTJweH0KCi8qID09PT09PT09PT09PSBsb2dzID09PT09PT09PT09PSAqLwoubG9nLXBhbmVse2JhY2tncm91bmQ6dmFyKC0tY2FyZCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOnZhcigtLXItbGcpO292ZXJmbG93OmhpZGRlbjthbmltYXRpb246Y2FyZC1pbiAuNHMgdmFyKC0tZWFzZSkgYm90aH0KLmxvZy1oZWFke2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjEwcHg7cGFkZGluZzoxNHB4IDE2cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSl9Ci5sb2ctaGVhZCBoM3tmb250LXNpemU6MTRweDtmb250LXdlaWdodDo4MDA7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4fQoubG9nLWhlYWQgaDMgc3Zne3dpZHRoOjE2cHg7aGVpZ2h0OjE2cHg7Y29sb3I6dmFyKC0tdmlvKX0KLmxvZy1maWx0ZXJze2Rpc3BsYXk6ZmxleDtnYXA6NnB4fQoubG9nLWxpc3R7bWF4LWhlaWdodDpjYWxjKDEwMHZoIC0gMjYwcHgpO292ZXJmbG93LXk6YXV0bzstd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzp0b3VjaH0KLmxvZy1pdGVte3BhZGRpbmc6MTJweCAxNnB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHJnYmEoMTQ2LDE3MCwyMDUsLjA3KTthbmltYXRpb246Y2FyZC1pbiAuM3MgdmFyKC0tZWFzZSkgYm90aH0KLmxvZy1pdGVtOmxhc3QtY2hpbGR7Ym9yZGVyLWJvdHRvbTpub25lfQoubG9nLXRpbWV7Zm9udC1zaXplOjEwcHg7Y29sb3I6dmFyKC0tdHh0Myk7bWFyZ2luLWJvdHRvbTozcHg7Zm9udC1mZWF0dXJlLXNldHRpbmdzOiJ0bnVtIn0KLmxvZy1tYWlue2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweDtmbGV4LXdyYXA6d3JhcDtmb250LXNpemU6MTNweH0KLmxvZy11c2Vye2ZvbnQtd2VpZ2h0OjgwMH0KLmxvZy1yZXN7Zm9udC13ZWlnaHQ6ODAwO2NvbG9yOnZhcigtLW9rKX0KLmxvZy1yZXMuZXJye2NvbG9yOnZhcigtLWVycil9Ci5sb2ctc3RlcHN7bWFyZ2luLXRvcDo2cHg7Zm9udC1zaXplOjExLjVweDtjb2xvcjp2YXIoLS10eHQyKTtsaW5lLWhlaWdodDoxLjc7cGFkZGluZy1sZWZ0OjJweH0KLmxvZy1zdGVwcyBpe2ZvbnQtc3R5bGU6bm9ybWFsO2NvbG9yOnZhcigtLWJyYW5kKTttYXJnaW4tcmlnaHQ6NXB4fQoubG9nLWVtcHR5e3BhZGRpbmc6NTBweCAyMHB4O3RleHQtYWxpZ246Y2VudGVyO2NvbG9yOnZhcigtLXR4dDMpO2ZvbnQtc2l6ZToxM3B4fQoKLyogPT09PT09PT09PT09IGNvbmZpZyA9PT09PT09PT09PT0gKi8KLmNmZy1wYW5lbHtiYWNrZ3JvdW5kOnZhcigtLWNhcmQpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czp2YXIoLS1yLWxnKTttYXJnaW4tYm90dG9tOjE2cHg7b3ZlcmZsb3c6aGlkZGVuO2FuaW1hdGlvbjpjYXJkLWluIC40cyB2YXIoLS1lYXNlKSBib3RofQouY2ZnLWhlYWR7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MTBweDtwYWRkaW5nOjE1cHggMTZweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKX0KLmNmZy1oZWFkIGgze2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjgwMDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHh9Ci5jZmctaGVhZCBoMyBzdmd7d2lkdGg6MTZweDtoZWlnaHQ6MTZweH0KLmNmZy1oZWFkIC5iYXJ7d2lkdGg6M3B4O2hlaWdodDoxNXB4O2JvcmRlci1yYWRpdXM6MnB4O2JhY2tncm91bmQ6dmFyKC0tYnJhbmQpO2ZsZXgtc2hyaW5rOjB9Ci5jZmctaGVhZCAuYmFyLmFtYmVye2JhY2tncm91bmQ6dmFyKC0td2Fybil9IC5jZmctaGVhZCAuYmFyLmdyZWVue2JhY2tncm91bmQ6dmFyKC0tb2spfSAuY2ZnLWhlYWQgLmJhci52aW97YmFja2dyb3VuZDp2YXIoLS12aW8pfQouY2ZnLWJvZHl7cGFkZGluZzoxNnB4fQouZm9ybS1ncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDFmcjtnYXA6MTJweH0KLmYtaXRlbXttaW4td2lkdGg6MH0KLmYtaXRlbS5mdWxse2dyaWQtY29sdW1uOjEvLTF9Ci5mLWl0ZW0gbGFiZWx7ZGlzcGxheTpibG9jaztmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS10eHQyKTtmb250LXdlaWdodDo3MDA7bWFyZ2luLWJvdHRvbTo2cHh9Ci5mLWl0ZW0gLmhpbnR7Zm9udC1zaXplOjEwLjVweDtjb2xvcjp2YXIoLS10eHQzKTttYXJnaW4tdG9wOjVweDtsaW5lLWhlaWdodDoxLjZ9Ci5mLWl0ZW0gLmhpbnQgY29kZXtiYWNrZ3JvdW5kOnJnYmEoMTQ2LDE3MCwyMDUsLjEyKTtwYWRkaW5nOjFweCA1cHg7Ym9yZGVyLXJhZGl1czo1cHg7Zm9udC1zaXplOjEwcHg7Zm9udC1mYW1pbHk6dWktbW9ub3NwYWNlLE1lbmxvLG1vbm9zcGFjZX0KLnN3aXRjaHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMHB4O3BhZGRpbmc6MTBweCAxMnB4O2JhY2tncm91bmQ6cmdiYSgxMCwxNSwzMCwuNDUpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxMnB4O2N1cnNvcjpwb2ludGVyO3RyYW5zaXRpb246Ym9yZGVyLWNvbG9yIC4yc30KLnN3aXRjaDphY3RpdmV7dHJhbnNmb3JtOnNjYWxlKC45OCl9Ci5zd2l0Y2ggLmxibHtmb250LXNpemU6MTIuNXB4O2ZvbnQtd2VpZ2h0OjYwMDtmbGV4OjF9Ci5zd2l0Y2ggLnNje2ZvbnQtc2l6ZToxMHB4O2NvbG9yOnZhcigtLXR4dDMpfQouc3d7cG9zaXRpb246cmVsYXRpdmU7d2lkdGg6NDRweDtoZWlnaHQ6MjZweDtib3JkZXItcmFkaXVzOjEzcHg7YmFja2dyb3VuZDpyZ2JhKDE0NiwxNzAsMjA1LC4yKTt0cmFuc2l0aW9uOmJhY2tncm91bmQgLjI1cyB2YXIoLS1lYXNlKTtmbGV4LXNocmluazowfQouc3c6OmFmdGVye2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7dG9wOjJweDtsZWZ0OjJweDt3aWR0aDoyMnB4O2hlaWdodDoyMnB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6I2ZmZjt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuMjVzIHZhcigtLXNwcmluZyk7Ym94LXNoYWRvdzowIDJweCA2cHggcmdiYSgwLDAsMCwuMzUpfQouc3dpdGNoIGlucHV0e2Rpc3BsYXk6bm9uZX0KLnN3aXRjaCBpbnB1dDpjaGVja2VkKy5zd3tiYWNrZ3JvdW5kOnZhcigtLWdyYWQpfQouc3dpdGNoIGlucHV0OmNoZWNrZWQrLnN3OjphZnRlcnt0cmFuc2Zvcm06dHJhbnNsYXRlWCgxOHB4KX0KLmFjYy1lZGl0e2JhY2tncm91bmQ6cmdiYSgxMCwxNSwzMCwuNCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjE2cHg7cGFkZGluZzoxNHB4O21hcmdpbi1ib3R0b206MTJweH0KLmFjYy1lZGl0LWhlYWR7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlcjttYXJnaW4tYm90dG9tOjEycHh9Ci5hY2MtZWRpdC10aXRsZXtmb250LXNpemU6MTNweDtmb250LXdlaWdodDo4MDA7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4fQouYWNjLWVkaXQtdGl0bGUgLm57d2lkdGg6MjRweDtoZWlnaHQ6MjRweDtib3JkZXItcmFkaXVzOjhweDtiYWNrZ3JvdW5kOnZhcigtLWJyYW5kU29mdCk7Y29sb3I6dmFyKC0tYnJhbmQpO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtmb250LXNpemU6MTFweDtmb250LXdlaWdodDo5MDB9Ci5hY2MtZWRpdC1oZWFkIC5hY3Rze2Rpc3BsYXk6ZmxleDtnYXA6NnB4fQouYnRuLXJvd3tkaXNwbGF5OmZsZXg7Z2FwOjEwcHg7bWFyZ2luLXRvcDoxNnB4O2ZsZXgtd3JhcDp3cmFwfQouYnRuLXJvdyAuYnRue2ZsZXg6MTttaW4td2lkdGg6MTIwcHh9Ci5jZmctbm90ZXtmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLXR4dDMpO2xpbmUtaGVpZ2h0OjEuNztwYWRkaW5nOjEycHggMTRweDtiYWNrZ3JvdW5kOnJnYmEoMjQ3LDE4NSw4NSwuMDcpO2JvcmRlcjoxcHggc29saWQgcmdiYSgyNDcsMTg1LDg1LC4xOCk7Ym9yZGVyLXJhZGl1czoxMnB4O21hcmdpbi10b3A6MTJweH0KLmNmZy1ub3RlIGJ7Y29sb3I6dmFyKC0td2Fybil9CgovKiA9PT09PT09PT09PT0gdGFiYmFyID09PT09PT09PT09PSAqLwpuYXYudGFiYmFyewogIHBvc2l0aW9uOmZpeGVkO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowO3otaW5kZXg6NjA7CiAgZGlzcGxheTpmbGV4O3BhZGRpbmc6OHB4IDEwcHggY2FsYyg4cHggKyB2YXIoLS1zYWZlLWIpKTsKICBiYWNrZ3JvdW5kOnJnYmEoMTAsMTUsMzAsLjgyKTstd2Via2l0LWJhY2tkcm9wLWZpbHRlcjpibHVyKDI0cHgpIHNhdHVyYXRlKDEuNik7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMjRweCkgc2F0dXJhdGUoMS42KTsKICBib3JkZXItdG9wOjFweCBzb2xpZCByZ2JhKDE0NiwxNzAsMjA1LC4xKTsKfQoudGFie2ZsZXg6MTtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6M3B4O3BhZGRpbmc6NnB4IDA7Ym9yZGVyLXJhZGl1czoxNHB4O2NvbG9yOnZhcigtLXR4dDMpO2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0OjcwMDt0cmFuc2l0aW9uOmNvbG9yIC4ycyx0cmFuc2Zvcm0gLjE2cyB2YXIoLS1zcHJpbmcpfQoudGFiIHN2Z3t3aWR0aDoyMnB4O2hlaWdodDoyMnB4fQoudGFiOmFjdGl2ZXt0cmFuc2Zvcm06c2NhbGUoLjkpfQoudGFiLm9ue2NvbG9yOnZhcigtLWJyYW5kKX0KLnRhYiAudC1pbmR7d2lkdGg6MTRweDtoZWlnaHQ6M3B4O2JvcmRlci1yYWRpdXM6MnB4O2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7dHJhbnNpdGlvbjpiYWNrZ3JvdW5kIC4yNXN9Ci50YWIub24gLnQtaW5ke2JhY2tncm91bmQ6dmFyKC0tYnJhbmQpfQoKLyogPT09PT09PT09PT09IHNoZWV0cyAmIHRvYXN0ID09PT09PT09PT09PSAqLwouc2hlZXQtYmFja2Ryb3B7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4OjEwMDtiYWNrZ3JvdW5kOnJnYmEoNCw4LDE4LC41NSk7LXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6Ymx1cig2cHgpO2JhY2tkcm9wLWZpbHRlcjpibHVyKDZweCk7b3BhY2l0eTowO3BvaW50ZXItZXZlbnRzOm5vbmU7dHJhbnNpdGlvbjpvcGFjaXR5IC4zcyB2YXIoLS1lYXNlKX0KLnNoZWV0LWJhY2tkcm9wLnNob3d7b3BhY2l0eToxO3BvaW50ZXItZXZlbnRzOmF1dG99Ci5zaGVldHtwb3NpdGlvbjpmaXhlZDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDt6LWluZGV4OjEwMTttYXgtaGVpZ2h0Ojg2dmg7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjsKICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxODBkZWcsdmFyKC0tY2FyZDIpLHZhcigtLWJnMikpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZTIpO2JvcmRlci1ib3R0b206bm9uZTsKICBib3JkZXItcmFkaXVzOjI2cHggMjZweCAwIDA7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoMTA0JSk7dHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjM4cyB2YXIoLS1zcHJpbmcpOwogIGJveC1zaGFkb3c6MCAtMThweCA1MHB4IHJnYmEoMCwwLDAsLjUpfQouc2hlZXQuc2hvd3t0cmFuc2Zvcm06dHJhbnNsYXRlWSgwKX0KLnNoZWV0LWdyYWJ7d2lkdGg6MzhweDtoZWlnaHQ6NHB4O2JvcmRlci1yYWRpdXM6MnB4O2JhY2tncm91bmQ6cmdiYSgxNDYsMTcwLDIwNSwuMyk7bWFyZ2luOjEwcHggYXV0byA0cHg7ZmxleC1zaHJpbms6MH0KLnNoZWV0LWhlYWR7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtwYWRkaW5nOjZweCAyMHB4IDEycHh9Ci5zaGVldC1oZWFkIGgze2ZvbnQtc2l6ZToxNnB4O2ZvbnQtd2VpZ2h0OjgwMDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo5cHh9Ci5zaGVldC1oZWFkIGgzIHN2Z3t3aWR0aDoxOHB4O2hlaWdodDoxOHB4fQouc2hlZXQtY2xvc2V7d2lkdGg6MzJweDtoZWlnaHQ6MzJweDtib3JkZXItcmFkaXVzOjEwcHg7YmFja2dyb3VuZDp2YXIoLS1jYXJkKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtjb2xvcjp2YXIoLS10eHQyKX0KLnNoZWV0LWNsb3NlOmFjdGl2ZXt0cmFuc2Zvcm06c2NhbGUoLjkpfQouc2hlZXQtYm9keXtwYWRkaW5nOjRweCAyMHB4IDI0cHg7b3ZlcmZsb3cteTphdXRvOy13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOnRvdWNofQouc3ItaXRlbXtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMnB4O3BhZGRpbmc6MTFweCAwO2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHJnYmEoMTQ2LDE3MCwyMDUsLjA4KTtmb250LXNpemU6MTNweH0KLnNyLWl0ZW06bGFzdC1jaGlsZHtib3JkZXItYm90dG9tOm5vbmV9Ci5zci1pdGVtIC5re2NvbG9yOnZhcigtLXR4dDIpO2ZvbnQtd2VpZ2h0OjYwMDtmbGV4LXNocmluazowfQouc3ItaXRlbSAudnt0ZXh0LWFsaWduOnJpZ2h0O2ZvbnQtd2VpZ2h0OjgwMH0KLnNyLWl0ZW0gLnYubW9ub3tmb250LWZhbWlseTp1aS1tb25vc3BhY2UsTWVubG8sbW9ub3NwYWNlO2ZvbnQtc2l6ZToxMnB4fQouc2lnLXJlc3VsdHttYXgtaGVpZ2h0OjUydmg7b3ZlcmZsb3cteTphdXRvOy13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOnRvdWNofQouc2lnLWNhcmR7Ym9yZGVyLXJhZGl1czoxNnB4O3BhZGRpbmc6MTNweCAxNHB4O21hcmdpbi1ib3R0b206MTBweDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpfQouc2lnLWNhcmQub2t7YmFja2dyb3VuZDp2YXIoLS1va1NvZnQpO2JvcmRlci1jb2xvcjpyZ2JhKDYxLDIyMCwxNTEsLjI1KX0KLnNpZy1jYXJkLmZhaWx7YmFja2dyb3VuZDp2YXIoLS1lcnJTb2Z0KTtib3JkZXItY29sb3I6cmdiYSgyNDksMTEyLDEwNiwuMjgpfQouc2lnLWNhcmQgLmh7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlcjtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo4MDA7bWFyZ2luLWJvdHRvbTo2cHh9Ci5zaWctY2FyZCAuaCAucntmb250LXNpemU6MTJweH0KLnNpZy1jYXJkLm9rIC5oIC5ye2NvbG9yOnZhcigtLW9rKX0gLnNpZy1jYXJkLmZhaWwgLmggLnJ7Y29sb3I6dmFyKC0tZXJyKX0KLnNpZy1jYXJkIC5zdGVwc3tmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS10eHQyKTtsaW5lLWhlaWdodDoxLjh9Ci5zaWctY2FyZCAuc3RlcHMgaXtmb250LXN0eWxlOm5vcm1hbDtjb2xvcjp2YXIoLS1icmFuZCk7bWFyZ2luLXJpZ2h0OjVweH0KLnNpZy1jYXJkIC5zdGVwcyAuZXJye2NvbG9yOnZhcigtLWVycil9CiN0b2FzdHtwb3NpdGlvbjpmaXhlZDtsZWZ0OjUwJTt0b3A6Y2FsYygxOHB4ICsgdmFyKC0tc2FmZS10KSk7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSkgdHJhbnNsYXRlWSgtMTZweCk7ei1pbmRleDoyMDA7CiAgZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4O21heC13aWR0aDo4NnZ3O3BhZGRpbmc6MTFweCAxOHB4O2JvcmRlci1yYWRpdXM6MTRweDtmb250LXNpemU6MTNweDtmb250LXdlaWdodDo3MDA7CiAgYmFja2dyb3VuZDpyZ2JhKDE3LDI2LDQ2LC45Mik7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMik7Ym94LXNoYWRvdzowIDEwcHggMzRweCByZ2JhKDAsMCwwLC40NSk7CiAgb3BhY2l0eTowO3BvaW50ZXItZXZlbnRzOm5vbmU7dHJhbnNpdGlvbjpvcGFjaXR5IC4yNXMsdHJhbnNmb3JtIC4zcyB2YXIoLS1zcHJpbmcpfQojdG9hc3Quc2hvd3tvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSkgdHJhbnNsYXRlWSgwKX0KI3RvYXN0IHN2Z3t3aWR0aDoxNnB4O2hlaWdodDoxNnB4O2ZsZXgtc2hyaW5rOjB9CiN0b2FzdC5va3tjb2xvcjp2YXIoLS1vayl9ICN0b2FzdC5lcnJ7Y29sb3I6dmFyKC0tZXJyKX0gI3RvYXN0LmluZm97Y29sb3I6dmFyKC0tYnJhbmQpfQojdG9hc3Qub2sgc3Zne2NvbG9yOnZhcigtLW9rKX0gI3RvYXN0LmVyciBzdmd7Y29sb3I6dmFyKC0tZXJyKX0gI3RvYXN0LmluZm8gc3Zne2NvbG9yOnZhcigtLWJyYW5kKX0KLmNvbmZpcm0tbGF5ZXJ7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4OjE1MDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7cGFkZGluZzozMHB4fQouY29uZmlybXt3aWR0aDptaW4oMzQwcHgsOTB2dyk7YmFja2dyb3VuZDp2YXIoLS1jYXJkMik7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMik7Ym9yZGVyLXJhZGl1czoyMHB4O3BhZGRpbmc6MjJweCAyMHB4IDE4cHg7dGV4dC1hbGlnbjpjZW50ZXI7Ym94LXNoYWRvdzowIDI0cHggNjBweCByZ2JhKDAsMCwwLC41NSk7YW5pbWF0aW9uOmNhcmQtaW4gLjNzIHZhcigtLXNwcmluZykgYm90aH0KLmNvbmZpcm0gLmN0e2ZvbnQtc2l6ZToxNXB4O2ZvbnQtd2VpZ2h0OjgwMDttYXJnaW4tYm90dG9tOjZweH0KLmNvbmZpcm0gLmNke2ZvbnQtc2l6ZToxMi41cHg7Y29sb3I6dmFyKC0tdHh0Mik7bGluZS1oZWlnaHQ6MS43O21hcmdpbi1ib3R0b206MThweH0KLmNvbmZpcm0gLmNie2Rpc3BsYXk6ZmxleDtnYXA6MTBweH0KLmNvbmZpcm0gLmNiIGJ1dHRvbntmbGV4OjE7aGVpZ2h0OjQycHg7Ym9yZGVyLXJhZGl1czoxM3B4O2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjcwMH0KLmNvbmZpcm0gLmNiIC5ub3tiYWNrZ3JvdW5kOnZhcigtLWNhcmQpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Y29sb3I6dmFyKC0tdHh0Mil9Ci5jb25maXJtIC5jYiAueWVze2JhY2tncm91bmQ6dmFyKC0tZ3JhZCk7Y29sb3I6IzA0MTIxQ30KCi8qID09PT09PT09PT09PSBtaXNjID09PT09PT09PT09PSAqLwouZm9vdHt0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOjEwcHggMCA0cHg7Zm9udC1zaXplOjEwLjVweDtjb2xvcjp2YXIoLS10eHQzKTtsaW5lLWhlaWdodDoxLjh9Ci5mb290IC5saW5re2NvbG9yOnZhcigtLWJyYW5kKTt0ZXh0LWRlY29yYXRpb246bm9uZTtmb250LXdlaWdodDo3MDB9Ci5oaWRkZW57ZGlzcGxheTpub25lIWltcG9ydGFudH0KQGtleWZyYW1lcyBwdWxzZXswJSwxMDAle29wYWNpdHk6MX01MCV7b3BhY2l0eTouNDV9fQoucHVsc2V7YW5pbWF0aW9uOnB1bHNlIDEuNnMgZWFzZS1pbi1vdXQgaW5maW5pdGV9CkBtZWRpYSAocHJlZmVycy1yZWR1Y2VkLW1vdGlvbjpyZWR1Y2UpewogICp7YW5pbWF0aW9uLWR1cmF0aW9uOi4wMW1zIWltcG9ydGFudDt0cmFuc2l0aW9uLWR1cmF0aW9uOi4wMW1zIWltcG9ydGFudH0KfQpAbWVkaWEgKG1pbi13aWR0aDo3MDBweCl7CiAgbWFpbnttYXgtd2lkdGg6NjgwcHg7bWFyZ2luOjAgYXV0b30KfQpAbWVkaWEgKG1heC13aWR0aDo2OTlweCl7CiAgaW5wdXRbdHlwZT10ZXh0XSxpbnB1dFt0eXBlPXBhc3N3b3JkXSxpbnB1dFt0eXBlPW51bWJlcl0sdGV4dGFyZWF7Zm9udC1zaXplOjE2cHghaW1wb3J0YW50fQp9Cjwvc3R5bGU+CjwvaGVhZD4KPGJvZHk+CjxkaXYgY2xhc3M9ImJnLWdsb3ciPjwvZGl2Pgo8ZGl2IGlkPSJhcHAiPgogIDxoZWFkZXIgY2xhc3M9ImFwcC1oZWFkZXIiPgogICAgPGRpdiBjbGFzcz0iYnJhbmQtbWFyayI+PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiPjxwYXRoIGQ9Ik00IDEzLjVDNCA5LjA4IDcuNTggNS41IDEyIDUuNXM4IDMuNTggOCA4IiBzdHJva2U9IiMwNDEyMUMiIHN0cm9rZS13aWR0aD0iMi40IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNMTIgMTNsNy41IDUuNSIgc3Ryb2tlPSIjMDQxMjFDIiBzdHJva2Utd2lkdGg9IjIuNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGNpcmNsZSBjeD0iNy41IiBjeT0iMTYuNSIgcj0iMi4yIiBmaWxsPSIjMDQxMjFDIi8+PGNpcmNsZSBjeD0iMTciIGN5PSIxOSIgcj0iMi4yIiBmaWxsPSIjMDQxMjFDIi8+PC9zdmc+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJicmFuZC10eHQiPgogICAgICA8aDE+5p6B5qC4IFpFRUhPIDxzcGFuIGNsYXNzPSJ2ZXItY2hpcCI+TElURTwvc3Bhbj48L2gxPgogICAgICA8cD7nrb7liLAgwrcg6L2m6L6GIMK3IOaOp+i9pjwvcD4KICAgIDwvZGl2PgogICAgPGRpdiBjbGFzcz0iaGVhZC1hY3Rpb25zIj4KICAgICAgPGRpdiBjbGFzcz0iY291bnQtY2hpcCBoaWRkZW4iIGlkPSJjb3VudENoaXAiIG9uY2xpY2s9InRvZ2dsZUF1dG9SZWZyZXNoKCkiPgogICAgICAgIDxzcGFuIGNsYXNzPSJjb3VudC1yaW5nIj48c3ZnIHZpZXdCb3g9IjAgMCAxNCAxNCI+PGNpcmNsZSBjbGFzcz0idHJhY2siIGN4PSI3IiBjeT0iNyIgcj0iNS42Ii8+PGNpcmNsZSBjbGFzcz0iYXJjIiBpZD0iY291bnRBcmMiIGN4PSI3IiBjeT0iNyIgcj0iNS42IiBzdHJva2UtZGFzaGFycmF5PSIzNS4yIiBzdHJva2UtZGFzaG9mZnNldD0iMzUuMiIvPjwvc3ZnPjwvc3Bhbj4KICAgICAgICA8c3BhbiBpZD0iY291bnRUeHQiPjYwczwvc3Bhbj4KICAgICAgPC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9Imljb24tYnRuIiBvbmNsaWNrPSJyZWZyZXNoQWxsKCkiIGFyaWEtbGFiZWw9IuWIt+aWsCI+PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTJhOSA5IDAgMSAxLTIuNjQtNi4zNiIvPjxwYXRoIGQ9Ik0yMSAzdjZoLTYiLz48L3N2Zz48L2J1dHRvbj4KICAgIDwvZGl2PgogIDwvaGVhZGVyPgoKICA8bWFpbiBpZD0ibWFpbiI+CiAgICA8ZGl2IGNsYXNzPSJwdHItd3JhcCIgaWQ9InB0cldyYXAiPgogICAgICA8ZGl2IGNsYXNzPSJwdHItaW5kaWNhdG9yIiBpZD0icHRySW5kIj48c3BhbiBjbGFzcz0ic3Bpbm5lciIgaWQ9InB0clNwaW4iPjwvc3Bhbj48c3BhbiBpZD0icHRyVHh0Ij7kuIvmi4nliLfmlrA8L3NwYW4+PC9kaXY+CiAgICAgIDxkaXYgaWQ9InBhZ2VIb21lIj48L2Rpdj4KICAgIDwvZGl2PgogICAgPGRpdiBpZD0icGFnZUxvZ3MiIGNsYXNzPSJoaWRkZW4iPjwvZGl2PgogICAgPGRpdiBpZD0icGFnZUNmZyIgY2xhc3M9ImhpZGRlbiI+PC9kaXY+CiAgPC9tYWluPgoKICA8bmF2IGNsYXNzPSJ0YWJiYXIiPgogICAgPGJ1dHRvbiBjbGFzcz0idGFiIG9uIiBkYXRhLXRhYj0iaG9tZSIgb25jbGljaz0ic3dpdGNoVGFiKCdob21lJykiPgogICAgICA8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMyAxMC41IDEyIDNsOSA3LjUiLz48cGF0aCBkPSJNNSA5LjVWMjFoMTRWOS41Ii8+PC9zdmc+CiAgICAgIOmmlumhtTxzcGFuIGNsYXNzPSJ0LWluZCI+PC9zcGFuPgogICAgPC9idXR0b24+CiAgICA8YnV0dG9uIGNsYXNzPSJ0YWIiIGRhdGEtdGFiPSJsb2dzIiBvbmNsaWNrPSJzd2l0Y2hUYWIoJ2xvZ3MnKSI+CiAgICAgIDxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik04IDZoMTNNOCAxMmgxM004IDE4aDEzIi8+PHBhdGggZD0iTTMgNmguMDFNMyAxMmguMDFNMyAxOGguMDEiLz48L3N2Zz4KICAgICAg5pel5b+XPHNwYW4gY2xhc3M9InQtaW5kIj48L3NwYW4+CiAgICA8L2J1dHRvbj4KICAgIDxidXR0b24gY2xhc3M9InRhYiIgZGF0YS10YWI9ImNmZyIgb25jbGljaz0ic3dpdGNoVGFiKCdjZmcnKSI+CiAgICAgIDxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiLz48cGF0aCBkPSJNMTkuNCAxNWExLjY1IDEuNjUgMCAwIDAgLjMzIDEuODJsLjA2LjA2YTIgMiAwIDEgMS0yLjgzIDIuODNsLS4wNi0uMDZhMS42NSAxLjY1IDAgMCAwLTEuODItLjMzIDEuNjUgMS42NSAwIDAgMC0xIDEuNTFWMjFhMiAyIDAgMSAxLTQgMHYtLjA5YTEuNjUgMS42NSAwIDAgMC0xLTEuNTEgMS42NSAxLjY1IDAgMCAwLTEuODIuMzNsLS4wNi4wNmEyIDIgMCAxIDEtMi44My0yLjgzbC4wNi0uMDZhMS42NSAxLjY1IDAgMCAwIC4zMy0xLjgyIDEuNjUgMS42NSAwIDAgMC0xLjUxLTFIM2EyIDIgMCAxIDEgMC00aC4wOWExLjY1IDEuNjUgMCAwIDAgMS41MS0xIDEuNjUgMS42NSAwIDAgMC0uMzMtMS44MmwtLjA2LS4wNmEyIDIgMCAxIDEgMi44My0yLjgzbC4wNi4wNmExLjY1IDEuNjUgMCAwIDAgMS44Mi4zM2guMDFhMS42NSAxLjY1IDAgMCAwIDEtMS41MVYzYTIgMiAwIDEgMSA0IDB2LjA5YTEuNjUgMS42NSAwIDAgMCAxIDEuNTFoLjAxYTEuNjUgMS42NSAwIDAgMCAxLjgyLS4zM2wuMDYtLjA2YTIgMiAwIDEgMSAyLjgzIDIuODNsLS4wNi4wNmExLjY1IDEuNjUgMCAwIDAtLjMzIDEuODJ2LjAxYTEuNjUgMS42NSAwIDAgMCAxLjUxIDFIMjFhMiAyIDAgMSAxIDAgNGgtLjA5YTEuNjUgMS42NSAwIDAgMC0xLjUxIDF6Ii8+PC9zdmc+CiAgICAgIOiuvue9rjxzcGFuIGNsYXNzPSJ0LWluZCI+PC9zcGFuPgogICAgPC9idXR0b24+CiAgPC9uYXY+CgogIDxkaXYgY2xhc3M9InNoZWV0LWJhY2tkcm9wIiBpZD0ic2hlZXRCYWNrZHJvcCIgb25jbGljaz0iY2xvc2VTaGVldCgpIj48L2Rpdj4KICA8ZGl2IGNsYXNzPSJzaGVldCIgaWQ9InNoZWV0Ij4KICAgIDxkaXYgY2xhc3M9InNoZWV0LWdyYWIiPjwvZGl2PgogICAgPGRpdiBjbGFzcz0ic2hlZXQtaGVhZCI+CiAgICAgIDxoMyBpZD0ic2hlZXRUaXRsZSI+PC9oMz4KICAgICAgPGJ1dHRvbiBjbGFzcz0ic2hlZXQtY2xvc2UiIG9uY2xpY2s9ImNsb3NlU2hlZXQoKSI+PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48cGF0aCBkPSJNMTggNiA2IDE4TTYgNmwxMiAxMiIvPjwvc3ZnPjwvYnV0dG9uPgogICAgPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJzaGVldC1ib2R5IiBpZD0ic2hlZXRCb2R5Ij48L2Rpdj4KICA8L2Rpdj4KCiAgPGRpdiBpZD0idG9hc3QiIHJvbGU9InN0YXR1cyI+PC9kaXY+CiAgPGRpdiBjbGFzcz0iY29uZmlybS1sYXllciBoaWRkZW4iIGlkPSJjb25maXJtTGF5ZXIiPjwvZGl2Pgo8L2Rpdj4KPHNjcmlwdD4KInVzZSBzdHJpY3QiOwovKiA9PT09PT09PT09PT09PT09PSDluLjph48gPT09PT09PT09PT09PT09PT0gKi8KY29uc3QgQVBQX1ZFUlNJT04gPSAidjIuMTQuMCI7CmNvbnN0IEtFWVMgPSB7IGNmZzoiemVlaG9fY2ZnIiwgYWNjb3VudHM6InplZWhvX2FjY291bnRzIiwgbG9nczoiemVlaG9fbG9ncyIgfTsKCi8qID09PT09PT09PT09PT09PT09IOW3peWFt+WHveaVsCA9PT09PT09PT09PT09PT09PSAqLwpmdW5jdGlvbiBnZXRVdWlkKCl7Y29uc3QgcD0ieHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4IixjPSJhYmNkZWYwMTIzNDU2Nzg5IjtsZXQgcj0iIjtmb3IoY29uc3QgY2ggb2YgcCl7aWYoY2g9PT0ieCJ8fGNoPT09InkiKXtjb25zdCBuPU1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSoxNik7cis9KGNoPT09InkiPyhuJjB4Myl8MHg4Om4pLnRvU3RyaW5nKDE2KX1lbHNlIHIrPWNofXJldHVybiByfQpmdW5jdGlvbiBnZXRSYW5kb21DaGFycyhuPTE2KXtjb25zdCBjPSIwMTIzNDU2Nzg5QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eiI7bGV0IHI9IiI7Zm9yKGxldCBpPTA7aTxuO2krKylyKz1jLmNoYXJBdChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqYy5sZW5ndGgpKTtyZXR1cm4gcn0KZnVuY3Rpb24gdG9RdWVyeShwPXt9KXtyZXR1cm4gT2JqZWN0LmtleXMocCkuZmlsdGVyKGs9PnBba10hPT11bmRlZmluZWQmJnBba10hPT1udWxsKS5zb3J0KCkubWFwKGs9PmsrIj0iK3Bba10pLmpvaW4oIiYiKX0KZnVuY3Rpb24gY2xlYW5Ub2tlbih0KXtyZXR1cm4gU3RyaW5nKHR8fCIiKS50cmltKCkucmVwbGFjZSgvXltiQl1lYXJlclxzKy9pLCIiKS5yZXBsYWNlKC9bXHMiJ2BdKy9nLCIiKX0KZnVuY3Rpb24gY2xlYW5CYXJrS2V5KGIpe2xldCBzPVN0cmluZyhifHwiIikudHJpbSgpLnJlcGxhY2UoL15bYkJdYXJrXHMqKGtleSk/XHMqWzrvvJpdXHMqL2ksIiIpLnJlcGxhY2UoL1tccyInYF0rL2csIiIpLnRyaW0oKTtyZXR1cm4gcy5yZXBsYWNlKC9cLyskLywiIil9CmZ1bmN0aW9uIG1hc2tWaW4odil7Y29uc3Qgcz1TdHJpbmcodnx8IiIpO2lmKCFzKXJldHVybiIiO2lmKHMubGVuZ3RoPD03KXJldHVybiIqKioqIjtyZXR1cm4gcy5zdWJzdHJpbmcoMCwzKSsiKioqKiIrcy5zdWJzdHJpbmcocy5sZW5ndGgtNCl9CmZ1bmN0aW9uIGRlZXBQaWNrKG9iaixrZXlzLGRlcHRoKXtpZighb2JqfHx0eXBlb2Ygb2JqIT09Im9iamVjdCJ8fChkZXB0aHx8MCk+NSlyZXR1cm4iIjtmb3IoY29uc3QgayBvZiBrZXlzKXtpZihvYmpba10hPT11bmRlZmluZWQmJm9ialtrXSE9PW51bGwmJm9ialtrXSE9PSIiKXJldHVybiBTdHJpbmcob2JqW2tdKX1mb3IoY29uc3QgayBpbiBvYmope2lmKG9ialtrXSYmdHlwZW9mIG9ialtrXT09PSJvYmplY3QiKXtjb25zdCByPWRlZXBQaWNrKG9ialtrXSxrZXlzLChkZXB0aHx8MCkrMSk7aWYocilyZXR1cm4gcn19cmV0dXJuIiJ9CmZ1bmN0aW9uIHBpY2tJb3RQcm9wKGQsaWRlbnRpZnkpe2NvbnN0IGFycj1kJiZkLmlvdFByb3BlcnRpZXM7aWYoQXJyYXkuaXNBcnJheShhcnIpKXtjb25zdCBrZXk9U3RyaW5nKGlkZW50aWZ5KS50b0xvd2VyQ2FzZSgpO2Zvcihjb25zdCBpdCBvZiBhcnIpe2lmKGl0JiZTdHJpbmcoaXQuaWRlbnRpZnl8fCIiKS50b0xvd2VyQ2FzZSgpPT09a2V5JiZpdC52YWx1ZSE9PW51bGwmJml0LnZhbHVlIT09dW5kZWZpbmVkJiZpdC52YWx1ZSE9PSIiKXJldHVybiBTdHJpbmcoaXQudmFsdWUpfX1yZXR1cm4iIn0KZnVuY3Rpb24gZ2V0RGV2aWNlSWRlbnRpZnkoYWNjKXtjb25zdCBzZWVkPVN0cmluZyhhY2MudXNlcklkfHxhY2MudmluTm98fCJ6ZWVoby1kZXZpY2UiKTtsZXQgaD0wO2ZvcihsZXQgaT0wO2k8c2VlZC5sZW5ndGg7aSsrKXtoPSgoaDw8NSktaCtzZWVkLmNoYXJDb2RlQXQoaSkpfDB9cmV0dXJuKE1hdGguYWJzKGgpLnRvU3RyaW5nKDE2KSsiMDAwMDAwMDAwMDAwMDAwMCIpLnNsaWNlKDAsMTYpfQpmdW5jdGlvbiBoYXNWYWxpZENvb3JkKGxhdCxsbmcpe2lmKGxhdD09PSIifHxsYXQ9PT1udWxsfHxsYXQ9PT11bmRlZmluZWR8fGxuZz09PSIifHxsbmc9PT1udWxsfHxsbmc9PT11bmRlZmluZWQpcmV0dXJuIGZhbHNlO2NvbnN0IGxhPU51bWJlcihsYXQpLGxuPU51bWJlcihsbmcpO3JldHVybiBpc0Zpbml0ZShsYSkmJmlzRmluaXRlKGxuKSYmTWF0aC5hYnMobGEpPD05MCYmTWF0aC5hYnMobG4pPD0xODAmJiEobGE9PT0wJiZsbj09PTApfQpmdW5jdGlvbiBub3JtYWxpemVSZWZyZXNoU2VjKHYpe2NvbnN0IG49TnVtYmVyKHYpO2lmKCFpc0Zpbml0ZShuKXx8bjw9MClyZXR1cm4gNjA7cmV0dXJuIE1hdGgubWF4KDE1LE1hdGgubWluKDM2MDAsTWF0aC5yb3VuZChuKSkpfQpmdW5jdGlvbiBlc2Mocyl7cmV0dXJuIFN0cmluZyhzPT1udWxsPyIiOnMpLnJlcGxhY2UoLyYvZywiJmFtcDsiKS5yZXBsYWNlKC88L2csIiZsdDsiKS5yZXBsYWNlKC8+L2csIiZndDsiKS5yZXBsYWNlKC8iL2csIiZxdW90OyIpfQoKLyogPT09PT09PT09PT09PT09PT0gTUQ1ID09PT09PT09PT09PT09PT09ICovCmZ1bmN0aW9uIG1kNSh0LGUpe2Z1bmN0aW9uIG4odCxlKXtyZXR1cm4gdDw8ZXx0Pj4+MzItZX1mdW5jdGlvbiByKHQsZSl7dmFyIG4scixvLGksYTtyZXR1cm4gbz0yMTQ3NDgzNjQ4JnQsaT0yMTQ3NDgzNjQ4JmUsYT0oMTA3Mzc0MTgyMyZ0KSsoMTA3Mzc0MTgyMyZlKSwobj0xMDczNzQxODI0JnQpJihyPTEwNzM3NDE4MjQmZSk/MjE0NzQ4MzY0OF5hXm9eaTpufHI/MTA3Mzc0MTgyNCZhPzMyMjEyMjU0NzJeYV5vXmk6MTA3Mzc0MTgyNF5hXm9eaTphXm9eaX1mdW5jdGlvbiBvKHQsZSxvLGksYSx1LGMpe3JldHVybiB0PXIodCxyKHIoZnVuY3Rpb24odCxlLG4pe3JldHVybiB0JmV8fnQmbn0oZSxvLGkpLGEpLGMpKSxyKG4odCx1KSxlKX1mdW5jdGlvbiBpKHQsZSxvLGksYSx1LGMpe3JldHVybiB0PXIodCxyKHIoZnVuY3Rpb24odCxlLG4pe3JldHVybiB0Jm58ZSZ+bn0oZSxvLGkpLGEpLGMpKSxyKG4odCx1KSxlKX1mdW5jdGlvbiBhKHQsZSxvLGksYSx1LGMpe3JldHVybiB0PXIodCxyKHIoZnVuY3Rpb24odCxlLG4pe3JldHVybiB0XmVebn0oZSxvLGkpLGEpLGMpKSxyKG4odCx1KSxlKX1mdW5jdGlvbiB1KHQsZSxvLGksYSx1LGMpe3JldHVybiB0PXIodCxyKHIoZnVuY3Rpb24odCxlLG4pe3JldHVybiBlXih0fH5uKX0oZSxvLGkpLGEpLGMpKSxyKG4odCx1KSxlKX1mdW5jdGlvbiBjKHQpe3ZhciBlLG49IiIscj0iIjtmb3IoZT0wO2U8PTM7ZSsrKW4rPShyPSIwIisodD4+PjgqZSYyNTUpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKHIubGVuZ3RoLTIsMik7cmV0dXJuIG59dmFyIHMsbCxmLHAsZCxoLHYseSxnLG09QXJyYXkoKTtmb3IobT1mdW5jdGlvbih0KXtmb3IodmFyIGUsbj10Lmxlbmd0aCxyPW4rOCxvPTE2Kigoci1yJTY0KS82NCsxKSxpPUFycmF5KG8tMSksYT0wLHU9MDt1PG47KWE9dSU0KjgsaVtlPSh1LXUlNCkvNF09aVtlXXx0LmNoYXJDb2RlQXQodSk8PGEsdSsrO3JldHVybiBhPXUlNCo4LGlbZT0odS11JTQpLzRdPWlbZV18MTI4PDxhLGlbby0yXT1uPDwzLGlbby0xXT1uPj4+MjksaX0odD1mdW5jdGlvbih0KXt0PXQucmVwbGFjZSgvXHJcbi9nLCJcbiIpO2Zvcih2YXIgZT0iIixuPTA7bjx0Lmxlbmd0aDtuKyspe3ZhciByPXQuY2hhckNvZGVBdChuKTtyPDEyOD9lKz1TdHJpbmcuZnJvbUNoYXJDb2RlKHIpOnI+MTI3JiZyPDIwNDg/KGUrPVN0cmluZy5mcm9tQ2hhckNvZGUocj4+NnwxOTIpLGUrPVN0cmluZy5mcm9tQ2hhckNvZGUoNjMmcnwxMjgpKTooZSs9U3RyaW5nLmZyb21DaGFyQ29kZShyPj4xMnwyMjQpLGUrPVN0cmluZy5mcm9tQ2hhckNvZGUocj4+NiY2M3wxMjgpLGUrPVN0cmluZy5mcm9tQ2hhckNvZGUoNjMmcnwxMjgpKX1yZXR1cm4gZX0odCkpLGg9MTczMjU4NDE5Myx2PTQwMjMyMzM0MTcseT0yNTYyMzgzMTAyLGc9MjcxNzMzODc4LHM9MDtzPG0ubGVuZ3RoO3MrPTE2KWw9aCxmPXYscD15LGQ9ZyxoPW8oaCx2LHksZyxtW3MrMF0sNywzNjE0MDkwMzYwKSxnPW8oZyxoLHYseSxtW3MrMV0sMTIsMzkwNTQwMjcxMCkseT1vKHksZyxoLHYsbVtzKzJdLDE3LDYwNjEwNTgxOSksdj1vKHYseSxnLGgsbVtzKzNdLDIyLDMyNTA0NDE5NjYpLGg9byhoLHYseSxnLG1bcys0XSw3LDQxMTg1NDgzOTkpLGc9byhnLGgsdix5LG1bcys1XSwxMiwxMjAwMDgwNDI2KSx5PW8oeSxnLGgsdixtW3MrNl0sMTcsMjgyMTczNTk1NSksdj1vKHYseSxnLGgsbVtzKzddLDIyLDQyNDkyNjEzMTMpLGg9byhoLHYseSxnLG1bcys4XSw3LDE3NzAwMzU0MTYpLGc9byhnLGgsdix5LG1bcys5XSwxMiwyMzM2NTUyODc5KSx5PW8oeSxnLGgsdixtW3MrMTBdLDE3LDQyOTQ5MjUyMzMpLHY9byh2LHksZyxoLG1bcysxMV0sMjIsMjMwNDU2MzEzNCksaD1vKGgsdix5LGcsbVtzKzEyXSw3LDE4MDQ2MDM2ODIpLGc9byhnLGgsdix5LG1bcysxM10sMTIsNDI1NDYyNjE5NSkseT1vKHksZyxoLHYsbVtzKzE0XSwxNywyNzkyOTY1MDA2KSxoPWkoaCx2PW8odix5LGcsaCxtW3MrMTVdLDIyLDEyMzY1MzUzMjkpLHksZyxtW3MrMV0sNSw0MTI5MTcwNzg2KSxnPWkoZyxoLHYseSxtW3MrNl0sOSwzMjI1NDY1NjY0KSx5PWkoeSxnLGgsdixtW3MrMTFdLDE0LDY0MzcxNzcxMyksdj1pKHYseSxnLGgsbVtzKzBdLDIwLDM5MjEwNjk5OTQpLGg9aShoLHYseSxnLG1bcys1XSw1LDM1OTM0MDg2MDUpLGc9aShnLGgsdix5LG1bcysxMF0sOSwzODAxNjA4MykseT1pKHksZyxoLHYsbVtzKzE1XSwxNCwzNjM0NDg4OTYxKSx2PWkodix5LGcsaCxtW3MrNF0sMjAsMzg4OTQyOTQ0OCksaD1pKGgsdix5LGcsbVtzKzldLDUsNTY4NDQ2NDM4KSxnPWkoZyxoLHYseSxtW3MrMTRdLDksMzI3NTE2MzYwNikseT1pKHksZyxoLHYsbVtzKzNdLDE0LDQxMDc2MDMzMzUpLHY9aSh2LHksZyxoLG1bcys4XSwyMCwxMTYzNTMxNTAxKSxoPWkoaCx2LHksZyxtW3MrMTNdLDUsMjg1MDI4NTgyOSksZz1pKGcsaCx2LHksbVtzKzJdLDksNDI0MzU2MzUxMikseT1pKHksZyxoLHYsbVtzKzddLDE0LDE3MzUzMjg0NzMpLGg9YShoLHY9aSh2LHksZyxoLG1bcysxMl0sMjAsMjM2ODM1OTU2MikseSxnLG1bcys1XSw0LDQyOTQ1ODg3MzgpLGc9YShnLGgsdix5LG1bcys4XSwxMSwyMjcyMzkyODMzKSx5PWEoeSxnLGgsdixtW3MrMTFdLDE2LDE4MzkwMzA1NjIpLHY9YSh2LHksZyxoLG1bcysxNF0sMjMsNDI1OTY1Nzc0MCksaD1hKGgsdix5LGcsbVtzKzFdLDQsMjc2Mzk3NTIzNiksZz1hKGcsaCx2LHksbVtzKzRdLDExLDEyNzI4OTMzNTMpLHk9YSh5LGcsaCx2LG1bcys3XSwxNiw0MTM5NDY5NjY0KSx2PWEodix5LGcsaCxtW3MrMTBdLDIzLDMyMDAyMzY2NTYpLGg9YShoLHYseSxnLG1bcysxM10sNCw2ODEyNzkxNzQpLGc9YShnLGgsdix5LG1bcyswXSwxMSwzOTM2NDMwMDc0KSx5PWEoeSxnLGgsdixtW3MrM10sMTYsMzU3MjQ0NTMxNyksdj1hKHYseSxnLGgsbVtzKzZdLDIzLDc2MDI5MTg5KSxoPWEoaCx2LHksZyxtW3MrOV0sNCwzNjU0NjAyODA5KSxnPWEoZyxoLHYseSxtW3MrMTJdLDExLDM4NzMxNTE0NjEpLHk9YSh5LGcsaCx2LG1bcysxNV0sMTYsNTMwNzQyNTIwKSxoPXUoaCx2PWEodix5LGcsaCxtW3MrMl0sMjMsMzI5OTYyODY0NSkseSxnLG1bcyswXSw2LDQwOTYzMzY0NTIpLGc9dShnLGgsdix5LG1bcys3XSwxMCwxMTI2ODkxNDE1KSx5PXUoeSxnLGgsdixtW3MrMTRdLDE1LDI4Nzg2MTIzOTEpLHY9dSh2LHksZyxoLG1bcys1XSwyMSw0MjM3NTMzMjQxKSxoPXUoaCx2LHksZyxtW3MrMTJdLDYsMTcwMDQ4NTU3MSksZz11KGcsaCx2LHksbVtzKzNdLDEwLDIzOTk5ODA2OTApLHk9dSh5LGcsaCx2LG1bcysxMF0sMTUsNDI5MzkxNTc3Myksdj11KHYseSxnLGgsbVtzKzFdLDIxLDIyNDAwNDQ0OTcpLGg9dShoLHYseSxnLG1bcys4XSw2LDE4NzMzMTMzNTkpLGc9dShnLGgsdix5LG1bcysxNV0sMTAsNDI2NDM1NTU1MikseT11KHksZyxoLHYsbVtzKzZdLDE1LDI3MzQ3Njg5MTYpLHY9dSh2LHksZyxoLG1bcysxM10sMjEsMTMwOTE1MTY0OSksaD11KGgsdix5LGcsbVtzKzRdLDYsNDE0OTQ0NDIyNiksZz11KGcsaCx2LHksbVtzKzExXSwxMCwzMTc0NzU2OTE3KSx5PXUoeSxnLGgsdixtW3MrMl0sMTUsNzE4Nzg3MjU5KSx2PXUodix5LGcsaCxtW3MrOV0sMjEsMzk1MTQ4MTc0NSksaD1yKGgsbCksdj1yKHYsZikseT1yKHkscCksZz1yKGcsZCk7cmV0dXJuIDMyPT1lPyhjKGgpK2ModikrYyh5KStjKGcpKS50b0xvd2VyQ2FzZSgpOihjKHYpK2MoeSkpLnRvTG93ZXJDYXNlKCl9Ci8qID09PT09PT09PT09PT09PT09IFNIQTEgPT09PT09PT09PT09PT09PT0gKi8KZnVuY3Rpb24gc2hhMShtc2cpe2Z1bmN0aW9uIHJvdGF0ZV9sZWZ0KG4scyl7dmFyIHQ0PShuPDxzKXwobj4+PigzMi1zKSk7cmV0dXJuIHQ0fTtmdW5jdGlvbiBjdnRfaGV4KHZhbCl7dmFyIHN0cj0nJzt2YXIgaTt2YXIgdjtmb3IoaT03O2k+PTA7aS0tKXt2PSh2YWw+Pj4oaSo0KSkmMHgwZjtzdHIrPXYudG9TdHJpbmcoMTYpfXJldHVybiBzdHJ9O2Z1bmN0aW9uIFV0ZjhFbmNvZGUoc3RyaW5nKXtzdHJpbmc9c3RyaW5nLnJlcGxhY2UoL1xyXG4vZywnXG4nKTt2YXIgdXRmdGV4dD0nJztmb3IodmFyIG49MDtuPHN0cmluZy5sZW5ndGg7bisrKXt2YXIgYz1zdHJpbmcuY2hhckNvZGVBdChuKTtpZihjPDEyOCl7dXRmdGV4dCs9U3RyaW5nLmZyb21DaGFyQ29kZShjKX1lbHNlIGlmKChjPjEyNykmJihjPDIwNDgpKXt1dGZ0ZXh0Kz1TdHJpbmcuZnJvbUNoYXJDb2RlKChjPj42KXwxOTIpO3V0ZnRleHQrPVN0cmluZy5mcm9tQ2hhckNvZGUoKGMmNjMpfDEyOCl9ZWxzZXt1dGZ0ZXh0Kz1TdHJpbmcuZnJvbUNoYXJDb2RlKChjPj4xMil8MjI0KTt1dGZ0ZXh0Kz1TdHJpbmcuZnJvbUNoYXJDb2RlKCgoYz4+NikmNjMpfDEyOCk7dXRmdGV4dCs9U3RyaW5nLmZyb21DaGFyQ29kZSgoYyY2Myl8MTI4KX19cmV0dXJuIHV0ZnRleHR9O3ZhciBibG9ja3N0YXJ0O3ZhciBpLGo7dmFyIFc9bmV3IEFycmF5KDgwKTt2YXIgSDA9MHg2NzQ1MjMwMTt2YXIgSDE9MHhFRkNEQUI4OTt2YXIgSDI9MHg5OEJBRENGRTt2YXIgSDM9MHgxMDMyNTQ3Njt2YXIgSDQ9MHhDM0QyRTFGMDt2YXIgQSxCLEMsRCxFO3ZhciB0ZW1wO21zZz1VdGY4RW5jb2RlKG1zZyk7dmFyIG1zZ19sZW49bXNnLmxlbmd0aDt2YXIgd29yZF9hcnJheT1uZXcgQXJyYXkoKTtmb3IoaT0wO2k8bXNnX2xlbi0zO2krPTQpe2o9bXNnLmNoYXJDb2RlQXQoaSk8PDI0fG1zZy5jaGFyQ29kZUF0KGkrMSk8PDE2fG1zZy5jaGFyQ29kZUF0KGkrMik8PDh8bXNnLmNoYXJDb2RlQXQoaSszKTt3b3JkX2FycmF5LnB1c2goail9c3dpdGNoKG1zZ19sZW4lNCl7Y2FzZSAwOmk9MHgwODAwMDAwMDA7YnJlYWs7Y2FzZSAxOmk9bXNnLmNoYXJDb2RlQXQobXNnX2xlbi0xKTw8MjR8MHgwODAwMDAwO2JyZWFrO2Nhc2UgMjppPW1zZy5jaGFyQ29kZUF0KG1zZ19sZW4tMik8PDI0fG1zZy5jaGFyQ29kZUF0KG1zZ19sZW4tMSk8PDE2fDB4MDgwMDA7YnJlYWs7Y2FzZSAzOmk9bXNnLmNoYXJDb2RlQXQobXNnX2xlbi0zKTw8MjR8bXNnLmNoYXJDb2RlQXQobXNnX2xlbi0yKTw8MTZ8bXNnLmNoYXJDb2RlQXQobXNnX2xlbi0xKTw8OHwweDgwO2JyZWFrfXdvcmRfYXJyYXkucHVzaChpKTt3aGlsZSgod29yZF9hcnJheS5sZW5ndGglMTYpIT0xNCl3b3JkX2FycmF5LnB1c2goMCk7d29yZF9hcnJheS5wdXNoKG1zZ19sZW4+Pj4yOSk7d29yZF9hcnJheS5wdXNoKChtc2dfbGVuPDwzKSYweDBmZmZmZmZmZik7Zm9yKGJsb2Nrc3RhcnQ9MDtibG9ja3N0YXJ0PHdvcmRfYXJyYXkubGVuZ3RoO2Jsb2Nrc3RhcnQrPTE2KXtmb3IoaT0wO2k8MTY7aSsrKVdbaV09d29yZF9hcnJheVtibG9ja3N0YXJ0K2ldO2ZvcihpPTE2O2k8PTc5O2krKylXW2ldPXJvdGF0ZV9sZWZ0KFdbaS0zXV5XW2ktOF1eV1tpLTE0XV5XW2ktMTZdLDEpO0E9SDA7Qj1IMTtDPUgyO0Q9SDM7RT1INDtmb3IoaT0wO2k8PTE5O2krKyl7dGVtcD0ocm90YXRlX2xlZnQoQSw1KSsoKEImQyl8KH5CJkQpKStFK1dbaV0rMHg1QTgyNzk5OSkmMHgwZmZmZmZmZmY7RT1EO0Q9QztDPXJvdGF0ZV9sZWZ0KEIsMzApO0I9QTtBPXRlbXB9Zm9yKGk9MjA7aTw9Mzk7aSsrKXt0ZW1wPShyb3RhdGVfbGVmdChBLDUpKyhCXkNeRCkrRStXW2ldKzB4NkVEOUVCQTEpJjB4MGZmZmZmZmZmO0U9RDtEPUM7Qz1yb3RhdGVfbGVmdChCLDMwKTtCPUE7QT10ZW1wfWZvcihpPTQwO2k8PTU5O2krKyl7dGVtcD0ocm90YXRlX2xlZnQoQSw1KSsoKEImQyl8KEImRCl8KEMmRCkpK0UrV1tpXSsweDhGMUJCQ0RDKSYweDBmZmZmZmZmZjtFPUQ7RD1DO0M9cm90YXRlX2xlZnQoQiwzMCk7Qj1BO0E9dGVtcH1mb3IoaT02MDtpPD03OTtpKyspe3RlbXA9KHJvdGF0ZV9sZWZ0KEEsNSkrKEJeQ15EKStFK1dbaV0rMHhDQTYyQzFENikmMHgwZmZmZmZmZmY7RT1EO0Q9QztDPXJvdGF0ZV9sZWZ0KEIsMzApO0I9QTtBPXRlbXB9SDA9KEgwK0EpJjB4MGZmZmZmZmZmO0gxPShIMStCKSYweDBmZmZmZmZmZjtIMj0oSDIrQykmMHgwZmZmZmZmZmY7SDM9KEgzK0QpJjB4MGZmZmZmZmZmO0g0PShINCtFKSYweDBmZmZmZmZmZn12YXIgdGVtcD1jdnRfaGV4KEgwKStjdnRfaGV4KEgxKStjdnRfaGV4KEgyKStjdnRfaGV4KEgzKStjdnRfaGV4KEg0KTtyZXR1cm4gdGVtcC50b0xvd2VyQ2FzZSgpfQovKiA9PT09PT09PT09PT09PT09PSBBRVMtMjU2LUVDQiArIFBLQ1M3ID09PT09PT09PT09PT09PT09ICovCmNvbnN0IEFFU19TQk9YPW5ldyBVaW50OEFycmF5KFsweDYzLDB4N2MsMHg3NywweDdiLDB4ZjIsMHg2YiwweDZmLDB4YzUsMHgzMCwweDAxLDB4NjcsMHgyYiwweGZlLDB4ZDcsMHhhYiwweDc2LDB4Y2EsMHg4MiwweGM5LDB4N2QsMHhmYSwweDU5LDB4NDcsMHhmMCwweGFkLDB4ZDQsMHhhMiwweGFmLDB4OWMsMHhhNCwweDcyLDB4YzAsMHhiNywweGZkLDB4OTMsMHgyNiwweDM2LDB4M2YsMHhmNywweGNjLDB4MzQsMHhhNSwweGU1LDB4ZjEsMHg3MSwweGQ4LDB4MzEsMHgxNSwweDA0LDB4YzcsMHgyMywweGMzLDB4MTgsMHg5NiwweDA1LDB4OWEsMHgwNywweDEyLDB4ODAsMHhlMiwweGViLDB4MjcsMHhiMiwweDc1LDB4MDksMHg4MywweDJjLDB4MWEsMHgxYiwweDZlLDB4NWEsMHhhMCwweDUyLDB4M2IsMHhkNiwweGIzLDB4MjksMHhlMywweDJmLDB4ODQsMHg1MywweGQxLDB4MDAsMHhlZCwweDIwLDB4ZmMsMHhiMSwweDViLDB4NmEsMHhjYiwweGJlLDB4MzksMHg0YSwweDRjLDB4NTgsMHhjZiwweGQwLDB4ZWYsMHhhYSwweGZiLDB4NDMsMHg0ZCwweDMzLDB4ODUsMHg0NSwweGY5LDB4MDIsMHg3ZiwweDUwLDB4M2MsMHg5ZiwweGE4LDB4NTEsMHhhMywweDQwLDB4OGYsMHg5MiwweDlkLDB4MzgsMHhmNSwweGJjLDB4YjYsMHhkYSwweDIxLDB4MTAsMHhmZiwweGYzLDB4ZDIsMHhjZCwweDBjLDB4MTMsMHhlYywweDVmLDB4OTcsMHg0NCwweDE3LDB4YzQsMHhhNywweDdlLDB4M2QsMHg2NCwweDVkLDB4MTksMHg3MywweDYwLDB4ODEsMHg0ZiwweGRjLDB4MjIsMHgyYSwweDkwLDB4ODgsMHg0NiwweGVlLDB4YjgsMHgxNCwweGRlLDB4NWUsMHgwYiwweGRiLDB4ZTAsMHgzMiwweDNhLDB4MGEsMHg0OSwweDA2LDB4MjQsMHg1YywweGMyLDB4ZDMsMHhhYywweDYyLDB4OTEsMHg5NSwweGU0LDB4NzksMHhlNywweGM4LDB4MzcsMHg2ZCwweDhkLDB4ZDUsMHg0ZSwweGE5LDB4NmMsMHg1NiwweGY0LDB4ZWEsMHg2NSwweDdhLDB4YWUsMHgwOCwweGJhLDB4NzgsMHgyNSwweDJlLDB4MWMsMHhhNiwweGI0LDB4YzYsMHhlOCwweGRkLDB4NzQsMHgxZiwweDRiLDB4YmQsMHg4YiwweDhhLDB4NzAsMHgzZSwweGI1LDB4NjYsMHg0OCwweDAzLDB4ZjYsMHgwZSwweDYxLDB4MzUsMHg1NywweGI5LDB4ODYsMHhjMSwweDFkLDB4OWUsMHhlMSwweGY4LDB4OTgsMHgxMSwweDY5LDB4ZDksMHg4ZSwweDk0LDB4OWIsMHgxZSwweDg3LDB4ZTksMHhjZSwweDU1LDB4MjgsMHhkZiwweDhjLDB4YTEsMHg4OSwweDBkLDB4YmYsMHhlNiwweDQyLDB4NjgsMHg0MSwweDk5LDB4MmQsMHgwZiwweGIwLDB4NTQsMHhiYiwweDE2XSk7CmNvbnN0IEFFU19SQ09OPW5ldyBVaW50OEFycmF5KFsweDAwLDB4MDEsMHgwMiwweDA0LDB4MDgsMHgxMCwweDIwLDB4NDAsMHg4MCwweDFiLDB4MzYsMHg2YywweGQ4LDB4YWIsMHg0ZF0pOwpmdW5jdGlvbiBhZXNHTXVsKGEsYil7bGV0IHA9MDtmb3IobGV0IGk9MDtpPDg7aSsrKXtpZihiJjEpcF49YTtjb25zdCBoaT1hJjB4ODA7YT0oYTw8MSkmMHhmZjtpZihoaSlhXj0weDFiO2I+Pj0xfXJldHVybiBwfQpmdW5jdGlvbiBhZXNLZXlFeHBhbnNpb24yNTYoa2V5KXtjb25zdCBOaz04LE5iPTQsTnI9MTQ7Y29uc3Qgdz1uZXcgVWludDhBcnJheSg0Kk5iKihOcisxKSk7Zm9yKGxldCBpPTA7aTxOayo0O2krKyl3W2ldPWtleVtpXTtmb3IobGV0IGk9Tms7aTxOYiooTnIrMSk7aSsrKXtsZXQgdDA9d1s0KihpLTEpXSx0MT13WzQqKGktMSkrMV0sdDI9d1s0KihpLTEpKzJdLHQzPXdbNCooaS0xKSszXTtpZihpJU5rPT09MCl7Y29uc3QgdG1wPXQwO3QwPUFFU19TQk9YW3QxXV5BRVNfUkNPTltpL05rXTt0MT1BRVNfU0JPWFt0Ml07dDI9QUVTX1NCT1hbdDNdO3QzPUFFU19TQk9YW3RtcF19ZWxzZSBpZihpJU5rPT09NCl7dDA9QUVTX1NCT1hbdDBdO3QxPUFFU19TQk9YW3QxXTt0Mj1BRVNfU0JPWFt0Ml07dDM9QUVTX1NCT1hbdDNdfXdbNCppXT13WzQqKGktTmspXV50MDt3WzQqaSsxXT13WzQqKGktTmspKzFdXnQxO3dbNCppKzJdPXdbNCooaS1OaykrMl1edDI7d1s0KmkrM109d1s0KihpLU5rKSszXV50M31yZXR1cm4gd30KZnVuY3Rpb24gYWVzRW5jcnlwdEJsb2NrKGlucHV0LHcpe2NvbnN0IE5iPTQsTnI9MTQ7Y29uc3Qgcz1uZXcgVWludDhBcnJheSgxNik7Zm9yKGxldCBpPTA7aTwxNjtpKyspc1tpXT1pbnB1dFtpXTtmb3IobGV0IGk9MDtpPDE2O2krKylzW2ldXj13W2ldO2ZvcihsZXQgcm91bmQ9MTtyb3VuZDw9TnI7cm91bmQrKyl7Zm9yKGxldCBpPTA7aTwxNjtpKyspc1tpXT1BRVNfU0JPWFtzW2ldXTtsZXQgdD1zWzFdO3NbMV09c1s1XTtzWzVdPXNbOV07c1s5XT1zWzEzXTtzWzEzXT10O3Q9c1syXTtzWzJdPXNbMTBdO3NbMTBdPXQ7dD1zWzZdO3NbNl09c1sxNF07c1sxNF09dDt0PXNbM107c1szXT1zWzE1XTtzWzE1XT1zWzExXTtzWzExXT1zWzddO3NbN109dDtpZihyb3VuZCE9PU5yKXtmb3IobGV0IGM9MDtjPDQ7YysrKXtjb25zdCBpPTQqYztjb25zdCBhMD1zW2ldLGExPXNbaSsxXSxhMj1zW2krMl0sYTM9c1tpKzNdO3NbaV09YWVzR011bChhMCwyKV5hZXNHTXVsKGExLDMpXmEyXmEzO3NbaSsxXT1hMF5hZXNHTXVsKGExLDIpXmFlc0dNdWwoYTIsMyleYTM7c1tpKzJdPWEwXmExXmFlc0dNdWwoYTIsMileYWVzR011bChhMywzKTtzW2krM109YWVzR011bChhMCwzKV5hMV5hMl5hZXNHTXVsKGEzLDIpfX1jb25zdCBvZmY9cm91bmQqMTY7Zm9yKGxldCBpPTA7aTwxNjtpKyspc1tpXV49d1tvZmYraV19cmV0dXJuIHN9CmZ1bmN0aW9uIGFlc1V0ZjhCeXRlcyhzdHIpe2NvbnN0IG91dD1bXTtmb3IobGV0IGk9MDtpPHN0ci5sZW5ndGg7aSsrKXtsZXQgYz1zdHIuY2hhckNvZGVBdChpKTtpZihjPDB4ODApb3V0LnB1c2goYyk7ZWxzZSBpZihjPDB4ODAwKW91dC5wdXNoKDB4YzB8KGM+PjYpLDB4ODB8KGMmMHgzZikpO2Vsc2UgaWYoYz49MHhkODAwJiZjPD0weGRiZmYpe2NvbnN0IGMyPXN0ci5jaGFyQ29kZUF0KCsraSk7Yz0weDEwMDAwKygoYy0weGQ4MDApPDwxMCkrKGMyLTB4ZGMwMCk7b3V0LnB1c2goMHhmMHwoYz4+MTgpLDB4ODB8KChjPj4xMikmMHgzZiksMHg4MHwoKGM+PjYpJjB4M2YpLDB4ODB8KGMmMHgzZikpfWVsc2Ugb3V0LnB1c2goMHhlMHwoYz4+MTIpLDB4ODB8KChjPj42KSYweDNmKSwweDgwfChjJjB4M2YpKX1yZXR1cm4gbmV3IFVpbnQ4QXJyYXkob3V0KX0KZnVuY3Rpb24gYWVzQnl0ZXNUb0Jhc2U2NChieXRlcyl7Y29uc3QgY2hhcnM9IkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8iO2xldCByZXN1bHQ9IiIsaT0wO2Zvcig7aSsyPGJ5dGVzLmxlbmd0aDtpKz0zKXtjb25zdCBuPShieXRlc1tpXTw8MTYpfChieXRlc1tpKzFdPDw4KXxieXRlc1tpKzJdO3Jlc3VsdCs9Y2hhcnNbKG4+PjE4KSY2M10rY2hhcnNbKG4+PjEyKSY2M10rY2hhcnNbKG4+PjYpJjYzXStjaGFyc1tuJjYzXX1jb25zdCByZW09Ynl0ZXMubGVuZ3RoLWk7aWYocmVtPT09MSl7Y29uc3Qgbj1ieXRlc1tpXTw8MTY7cmVzdWx0Kz1jaGFyc1sobj4+MTgpJjYzXStjaGFyc1sobj4+MTIpJjYzXSsiPT0ifWVsc2UgaWYocmVtPT09Mil7Y29uc3Qgbj0oYnl0ZXNbaV08PDE2KXwoYnl0ZXNbaSsxXTw8OCk7cmVzdWx0Kz1jaGFyc1sobj4+MTgpJjYzXStjaGFyc1sobj4+MTIpJjYzXStjaGFyc1sobj4+NikmNjNdKyI9In1yZXR1cm4gcmVzdWx0fQpmdW5jdGlvbiBhZXMyNTZFY2JFbmNyeXB0QmFzZTY0KHBsYWludGV4dCxrZXlTdHIpe2NvbnN0IGtleT1hZXNVdGY4Qnl0ZXMoa2V5U3RyKTtpZihrZXkubGVuZ3RoIT09MzIpdGhyb3cgbmV3IEVycm9yKCJBRVMtMjU26ZyA6KaBMzLlrZfoioLlr4bpkqXvvIzlvZPliY0iK2tleS5sZW5ndGgpO2NvbnN0IHc9YWVzS2V5RXhwYW5zaW9uMjU2KGtleSk7Y29uc3QgZGF0YT1hZXNVdGY4Qnl0ZXMocGxhaW50ZXh0KTtjb25zdCBwYWRMZW49MTYtKGRhdGEubGVuZ3RoJTE2KTtjb25zdCBwYWRkZWQ9bmV3IFVpbnQ4QXJyYXkoZGF0YS5sZW5ndGgrcGFkTGVuKTtwYWRkZWQuc2V0KGRhdGEpO2ZvcihsZXQgaT1kYXRhLmxlbmd0aDtpPHBhZGRlZC5sZW5ndGg7aSsrKXBhZGRlZFtpXT1wYWRMZW47Y29uc3Qgb3V0PW5ldyBVaW50OEFycmF5KHBhZGRlZC5sZW5ndGgpO2ZvcihsZXQgb2ZmPTA7b2ZmPHBhZGRlZC5sZW5ndGg7b2ZmKz0xNil7b3V0LnNldChhZXNFbmNyeXB0QmxvY2socGFkZGVkLnNsaWNlKG9mZixvZmYrMTYpLHcpLG9mZil9cmV0dXJuIGFlc0J5dGVzVG9CYXNlNjQob3V0KX0KCi8qID09PT09PT09PT09PT09PT09IOWtmOWCqCA9PT09PT09PT09PT09PT09PSAqLwpmdW5jdGlvbiBsb2FkSlNPTihrLGZhbGxiYWNrKXt0cnl7Y29uc3QgcmF3PWxvY2FsU3RvcmFnZS5nZXRJdGVtKGspO2lmKCFyYXcpcmV0dXJuIGZhbGxiYWNrO2NvbnN0IHY9SlNPTi5wYXJzZShyYXcpO3JldHVybiB2PT09dW5kZWZpbmVkfHx2PT09bnVsbD9mYWxsYmFjazp2fWNhdGNoKGUpe3JldHVybiBmYWxsYmFja319CmZ1bmN0aW9uIHNhdmVKU09OKGssdil7dHJ5e2xvY2FsU3RvcmFnZS5zZXRJdGVtKGssSlNPTi5zdHJpbmdpZnkodikpO3JldHVybiB0cnVlfWNhdGNoKGUpe3JldHVybiBmYWxzZX19CmNvbnN0IERFRkFVTFRfQ0ZHPXthcHA6e2FwcElkOiJTN3FQV1BVMSIsYXBwU2VjcmV0OiJjNWUwZGE3ZjRkYTI4ZGY4MDU2OTRlYzNkZDFmYzY3OTJlOWRmOTlkIn0saDU6e2FwcElkOiJTdzVGOXVKaSIsYXBwU2VjcmV0OiI0Njg3MGE4ZjY3OGEwOTEwOTQ2OGY1YjAxNjg4MThiOTFjMjkyODQ1In0sY29tbXVuaXR5OntlbmFibGVQb3N0OnRydWUsZW5hYmxlTGlrZTp0cnVlLGVuYWJsZUNvbW1lbnQ6dHJ1ZSxlbmFibGVTaGFyZTp0cnVlLGVuYWJsZURlbGV0ZTp0cnVlfSx2ZWhpY2xlQWVzS2V5OiIiLGF1dG9SZWZyZXNoU2VjOjYwLHNlcnZlckJhc2U6IiJ9OwpmdW5jdGlvbiBnZXRDZmcoKXtjb25zdCBjPWxvYWRKU09OKEtFWVMuY2ZnLG51bGwpO2lmKCFjKXJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KERFRkFVTFRfQ0ZHKSk7cmV0dXJue2FwcDp7YXBwSWQ6Yy5hcHA/LmFwcElkfHxERUZBVUxUX0NGRy5hcHAuYXBwSWQsYXBwU2VjcmV0OmMuYXBwPy5hcHBTZWNyZXR8fERFRkFVTFRfQ0ZHLmFwcC5hcHBTZWNyZXR9LGg1OnthcHBJZDpjLmg1Py5hcHBJZHx8REVGQVVMVF9DRkcuaDUuYXBwSWQsYXBwU2VjcmV0OmMuaDU/LmFwcFNlY3JldHx8REVGQVVMVF9DRkcuaDUuYXBwU2VjcmV0fSxjb21tdW5pdHk6e2VuYWJsZVBvc3Q6Yy5jb21tdW5pdHk/LmVuYWJsZVBvc3QhPT1mYWxzZSxlbmFibGVMaWtlOmMuY29tbXVuaXR5Py5lbmFibGVMaWtlIT09ZmFsc2UsZW5hYmxlQ29tbWVudDpjLmNvbW11bml0eT8uZW5hYmxlQ29tbWVudCE9PWZhbHNlLGVuYWJsZVNoYXJlOmMuY29tbXVuaXR5Py5lbmFibGVTaGFyZSE9PWZhbHNlLGVuYWJsZURlbGV0ZTpjLmNvbW11bml0eT8uZW5hYmxlRGVsZXRlIT09ZmFsc2V9LHZlaGljbGVBZXNLZXk6KHR5cGVvZiBjLnZlaGljbGVBZXNLZXk9PT0ic3RyaW5nIj9jLnZlaGljbGVBZXNLZXk6IiIpLnRyaW0oKSxhdXRvUmVmcmVzaFNlYzpub3JtYWxpemVSZWZyZXNoU2VjKGMuYXV0b1JlZnJlc2hTZWMpLHNlcnZlckJhc2U6U3RyaW5nKGMuc2VydmVyQmFzZXx8IiIpLnRyaW0oKX19CmZ1bmN0aW9uIHNhdmVDZmcoYyl7cmV0dXJuIHNhdmVKU09OKEtFWVMuY2ZnLGMpfQpmdW5jdGlvbiBnZXRBY2NvdW50cygpe2NvbnN0IGE9bG9hZEpTT04oS0VZUy5hY2NvdW50cyxbXSk7cmV0dXJuIEFycmF5LmlzQXJyYXkoYSk/YTpbXX0KZnVuY3Rpb24gc2F2ZUFjY291bnRzKGxpc3Qpe3JldHVybiBzYXZlSlNPTihLRVlTLmFjY291bnRzLGxpc3QpfQpmdW5jdGlvbiBnZXRMb2dzKCl7Y29uc3QgYT1sb2FkSlNPTihLRVlTLmxvZ3MsW10pO3JldHVybiBBcnJheS5pc0FycmF5KGEpP2E6W119CmZ1bmN0aW9uIGFkZExvZyhlbnRyeSl7Y29uc3QgbG9ncz1nZXRMb2dzKCk7bG9ncy51bnNoaWZ0KGVudHJ5KTtpZihsb2dzLmxlbmd0aD41MClsb2dzLmxlbmd0aD01MDtzYXZlSlNPTihLRVlTLmxvZ3MsbG9ncyl9CmZ1bmN0aW9uIGNsZWFyTG9ncygpe3JldHVybiBzYXZlSlNPTihLRVlTLmxvZ3MsW10pfQpmdW5jdGlvbiBpc1Byb3h5TW9kZSgpe3JldHVybiAhISh3aW5kb3cuX19QQU5FTF9NT0RFX18pfHwhIWdldENmZygpLnNlcnZlckJhc2V9Ci8qID09PT09PT09PT09PT09PT09IOetvuWQjSA9PT09PT09PT09PT09PT09PSAqLwpmdW5jdGlvbiBnZXRTaWduKHR5cGUscGFyYW1zPXt9LGJvZHk9JycsY2ZnKXtjb25zdCBjPWNmZ3x8Z2V0Q2ZnKCk7Y29uc3QgYWM9Y1t0eXBlXXx8Yy5hcHA7Y29uc3QgcXVlcnk9dG9RdWVyeShwYXJhbXMpO2NvbnN0IHRpbWVzdGFtcD1uZXcgRGF0ZSgpLmdldFRpbWUoKTtjb25zdCBub25jZT10eXBlPT09Img1Ij9nZXRVdWlkKCk6dGltZXN0YW1wK2dldFJhbmRvbUNoYXJzKCk7Y29uc3QgcGFyYW09ImFwcElkPSIrYWMuYXBwSWQrIiZub25jZT0iK25vbmNlKyImdGltZXN0YW1wPSIrdGltZXN0YW1wO2NvbnN0IGJvZHlTdHI9Ym9keT8odHlwZW9mIGJvZHk9PT0ic3RyaW5nIj9ib2R5OkpTT04uc3RyaW5naWZ5KGJvZHkpKTonJztjb25zdCBzaWduYXR1cmU9dHlwZT09PSJoNSI/KHF1ZXJ5K3BhcmFtK2FjLmFwcFNlY3JldCk6KGJvZHlTdHIrcGFyYW0rYWMuYXBwU2VjcmV0KTtjb25zdCBzaWduPW1kNShzaGExKHNpZ25hdHVyZSksMzIpLnRvU3RyaW5nKCk7cmV0dXJueydjZm1vdG8teC1wYXJhbSc6cGFyYW0sJ2NmbW90by14LXNpZ24nOnNpZ24sJ2NmbW90by14LXNpZ24tdHlwZSc6JzAnLCd0aW1lc3RhbXAnOlN0cmluZyh0aW1lc3RhbXApLCdub25jZSc6bm9uY2UsJ3NpZ25hdHVyZSc6c2lnbn19CgovLyBINSDnq6/lkKsgYm9keSDnrb7lkI3vvIhsb2dpbkJ5UGhvbmUg562J5o6l5Y+j5b+F6aG75oqK6K+35rGC5L2T57qz5YWl562+5ZCN77yM5ZCm5YiZ6L+U5ZueIHBlcm1pdCBlcnJvcu+8iQpmdW5jdGlvbiBoNVNpZ25XaXRoQm9keShib2R5LGNmZyl7Y29uc3QgYz1jZmd8fGdldENmZygpO2NvbnN0IGFjPWMuaDV8fGMuYXBwO2NvbnN0IHRpbWVzdGFtcD1uZXcgRGF0ZSgpLmdldFRpbWUoKTtjb25zdCBub25jZT1nZXRVdWlkKCk7Y29uc3QgcGFyYW09ImFwcElkPSIrYWMuYXBwSWQrIiZub25jZT0iK25vbmNlKyImdGltZXN0YW1wPSIrdGltZXN0YW1wO2NvbnN0IGJvZHlTdHI9dHlwZW9mIGJvZHk9PT0ic3RyaW5nIj9ib2R5OkpTT04uc3RyaW5naWZ5KGJvZHkpO2NvbnN0IHNpZ249bWQ1KHNoYTEoYm9keVN0citwYXJhbSthYy5hcHBTZWNyZXQpLDMyKS50b1N0cmluZygpO3JldHVybnsnY2Ztb3RvLXgtcGFyYW0nOnBhcmFtLCdjZm1vdG8teC1zaWduJzpzaWduLCdjZm1vdG8teC1zaWduLXR5cGUnOicwJywndGltZXN0YW1wJzpTdHJpbmcodGltZXN0YW1wKSwnbm9uY2UnOm5vbmNlLCdhcHBJZCc6YWMuYXBwSWR9fQoKLyogPT09PT09PT09PT09PT09PT0gSFRUUO+8iGZldGNoIOeJiO+8iSA9PT09PT09PT09PT09PT09PSAqLwphc3luYyBmdW5jdGlvbiBodHRwR2V0KHVybCxoZWFkZXJzLHRpbWVvdXRNcyl7Y29uc3QgY3RybD10aW1lb3V0TXM/QWJvcnRTaWduYWwudGltZW91dCh0aW1lb3V0TXMpOnVuZGVmaW5lZDt0cnl7Y29uc3Qgcj1hd2FpdCBmZXRjaCh1cmwse21ldGhvZDoiR0VUIixoZWFkZXJzOmhlYWRlcnN8fHt9LHNpZ25hbDpjdHJsfSk7Y29uc3QgdD1hd2FpdCByLnRleHQoKTt0cnl7cmV0dXJuIEpTT04ucGFyc2UodCl9Y2F0Y2goZSl7cmV0dXJue2Vycm9yOiJwYXJzZSBlcnJvciIscmF3OnR9fX1jYXRjaChlKXtyZXR1cm57ZXJyb3I6U3RyaW5nKChlJiZlLm1lc3NhZ2UpfHxlKX19fQphc3luYyBmdW5jdGlvbiBodHRwUG9zdCh1cmwsaGVhZGVycyxib2R5LHRpbWVvdXRNcyl7Y29uc3QgY3RybD10aW1lb3V0TXM/QWJvcnRTaWduYWwudGltZW91dCh0aW1lb3V0TXMpOnVuZGVmaW5lZDt0cnl7Y29uc3Qgcj1hd2FpdCBmZXRjaCh1cmwse21ldGhvZDoiUE9TVCIsaGVhZGVyczpoZWFkZXJzfHx7fSxib2R5OnR5cGVvZiBib2R5PT09InN0cmluZyI/Ym9keTpKU09OLnN0cmluZ2lmeShib2R5PT1udWxsP3t9OmJvZHkpLHNpZ25hbDpjdHJsfSk7Y29uc3QgdD1hd2FpdCByLnRleHQoKTt0cnl7cmV0dXJuIEpTT04ucGFyc2UodCl9Y2F0Y2goZSl7cmV0dXJue2Vycm9yOiJwYXJzZSBlcnJvciIscmF3OnR9fX1jYXRjaChlKXtyZXR1cm57ZXJyb3I6U3RyaW5nKChlJiZlLm1lc3NhZ2UpfHxlKX19fQphc3luYyBmdW5jdGlvbiBodHRwUHV0KHVybCxoZWFkZXJzLGJvZHksdGltZW91dE1zKXtjb25zdCBjdHJsPXRpbWVvdXRNcz9BYm9ydFNpZ25hbC50aW1lb3V0KHRpbWVvdXRNcyk6dW5kZWZpbmVkO3RyeXtjb25zdCByPWF3YWl0IGZldGNoKHVybCx7bWV0aG9kOiJQVVQiLGhlYWRlcnM6aGVhZGVyc3x8e30sYm9keTpib2R5IT09dW5kZWZpbmVkJiZib2R5IT09bnVsbD8odHlwZW9mIGJvZHk9PT0ic3RyaW5nIj9ib2R5OkpTT04uc3RyaW5naWZ5KGJvZHkpKTp1bmRlZmluZWQsc2lnbmFsOmN0cmx9KTtjb25zdCB0PWF3YWl0IHIudGV4dCgpO3RyeXtyZXR1cm4gSlNPTi5wYXJzZSh0KX1jYXRjaChlKXtyZXR1cm57ZXJyb3I6InBhcnNlIGVycm9yIixyYXc6dH19fWNhdGNoKGUpe3JldHVybntlcnJvcjpTdHJpbmcoKGUmJmUubWVzc2FnZSl8fGUpfX19CmFzeW5jIGZ1bmN0aW9uIGh0dHBEZWxldGUodXJsLGhlYWRlcnMsdGltZW91dE1zKXtjb25zdCBjdHJsPXRpbWVvdXRNcz9BYm9ydFNpZ25hbC50aW1lb3V0KHRpbWVvdXRNcyk6dW5kZWZpbmVkO3RyeXtjb25zdCByPWF3YWl0IGZldGNoKHVybCx7bWV0aG9kOiJERUxFVEUiLGhlYWRlcnM6aGVhZGVyc3x8e30sc2lnbmFsOmN0cmx9KTtjb25zdCB0PWF3YWl0IHIudGV4dCgpO3RyeXtyZXR1cm4gSlNPTi5wYXJzZSh0KX1jYXRjaChlKXtyZXR1cm57ZXJyb3I6InBhcnNlIGVycm9yIixyYXc6dH19fWNhdGNoKGUpe3JldHVybntlcnJvcjpTdHJpbmcoKGUmJmUubWVzc2FnZSl8fGUpfX19CmZ1bmN0aW9uIG5ldHdvcmtIaW50KHJlcyl7Y29uc3QgbT1TdHJpbmcoKHJlcyYmcmVzLmVycm9yKXx8IiIpO2lmKC9mYWlsZWQgdG8gZmV0Y2h8bmV0d29ya2Vycm9yfGNvcnN8bG9hZCBmYWlsZWR85peg5rOV6L+e5o6lfOe9kee7nC9pLnRlc3QobSkpcmV0dXJuIue9kee7nC/ot6jln5/lj5fpmZDvvJrnm7Tov57mqKHlvI/pnIAgWkVFSE8g5pyN5Yqh56uv5pS+6KGMIENPUlPvvIzoi6XlpLHotKXor7flnKjjgIzorr7nva4t5pyN5Yqh5Zyw5Z2A44CN5aGr5YWl5Y6f6ISa5pys5Zyw5Z2A6LWw5Luj55CG5qih5byPIjtyZXR1cm4iIn0KCi8qID09PT09PT09PT09PT09PT09IOebtOi/nuWQjuerr++8iOa1j+iniOWZqOebtOaOpeiwgyBaRUVITyBBUEnvvIkgPT09PT09PT09PT09PT09PT0gKi8KZnVuY3Rpb24gYmFzZUhlYWRlcnMoYWNjKXtjb25zdCB1YT1hY2MudXNlckFnZW50fHwiTU9CSUxFfGlPU3wxNi4xLjF8WkVFSE9fQVBQfDMuMC4xfGlQaG9uZXxXV0FOfGlPUyI7Y29uc3QgaD17IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgIitjbGVhblRva2VuKGFjYy50b2tlbiksIkNvbnRlbnQtVHlwZSI6ImFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD1VVEYtOCIsImludGVyZmFjZXZlcnNpb24iOiIyIiwiQWNjZXB0LUxhbmd1YWdlIjoiemgtQ04iLCJBY2NlcHQiOiIqLyoiLCJVc2VyLUFnZW50Ijp1YSwieC1hcHAtaW5mbyI6dWF9O2lmKGFjYy51c2VySWQpe2hbInVzZXJfaWQiXT1TdHJpbmcoYWNjLnVzZXJJZCk7aFsiQ29va2llIl09InVzZXJfaWQ9IithY2MudXNlcklkfXJldHVybiBofQoKYXN5bmMgZnVuY3Rpb24gZmV0Y2hWZWhpY2xlTGlzdChhY2MsY2ZnKXt0cnl7Y29uc3QgdG9rZW49Y2xlYW5Ub2tlbihhY2MudG9rZW4pO2NvbnN0IHNpZ25IPWdldFNpZ24oImFwcCIse30sJycsY2ZnKTtjb25zdCBoZWFkZXJzPXsiQXV0aG9yaXphdGlvbiI6IkJlYXJlciAiK3Rva2VuLCJDb250ZW50LVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9VVRGLTgiLCJpbnRlcmZhY2V2ZXJzaW9uIjoiMiIsLi4uc2lnbkh9O2lmKGFjYy51c2VySWQpaGVhZGVyc1sidXNlcl9pZCJdPVN0cmluZyhhY2MudXNlcklkKTtjb25zdCByZXM9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvYXBwL2NmbW90b3NlcnZlcmFwcC92ZWhpY2xlL2xpc3QiLGhlYWRlcnMpO2xldCBsaXN0PVtdO2lmKHJlcy5jb2RlPT0iMTAwMDAifHxyZXMuY29kZT09PTEwMDAwKXtpZihBcnJheS5pc0FycmF5KHJlcy5kYXRhKSlsaXN0PXJlcy5kYXRhO2Vsc2UgaWYocmVzLmRhdGEmJkFycmF5LmlzQXJyYXkocmVzLmRhdGEubGlzdCkpbGlzdD1yZXMuZGF0YS5saXN0O2Vsc2UgaWYocmVzLmRhdGEmJkFycmF5LmlzQXJyYXkocmVzLmRhdGEucmVjb3JkcykpbGlzdD1yZXMuZGF0YS5yZWNvcmRzO2Vsc2UgaWYocmVzLmRhdGEmJkFycmF5LmlzQXJyYXkocmVzLmRhdGEucm93cykpbGlzdD1yZXMuZGF0YS5yb3dzfXJldHVybiBsaXN0Lm1hcCh2PT4oe3Zpbk5vOlN0cmluZyh2LnZpbk5vfHx2LmZyYW1lTm98fHYudmlufHwiIikudHJpbSgpLG5hbWU6U3RyaW5nKHYudmVoaWNsZU5hbWV8fHYudmVoaWNsZVR5cGV8fHYuZGV2aWNlTmFtZXx8di5uYW1lfHwi6L2m6L6GIikudHJpbSgpfHwi6L2m6L6GIixwaWM6U3RyaW5nKHYudmVoaWNsZVBpY1VybHx8di5waWN8fHYuaW1hZ2VVcmx8fCIiKS50cmltKCksdmVoaWNsZVR5cGU6U3RyaW5nKHYudmVoaWNsZVR5cGV8fHYudHlwZXx8IiIpLnRyaW0oKSxsaWNlbnNlUGxhdGU6di5saWNlbnNlUGxhdGV8fG51bGx9KSkuZmlsdGVyKHY9PnYudmluTm8pfWNhdGNoKGUpe3JldHVybltdfX0KCmFzeW5jIGZ1bmN0aW9uIGZldGNoVmVoaWNsZVdpZGdldHMoYWNjLGNmZyx2aW5Obyl7dHJ5e2NvbnN0IHRva2VuPWNsZWFuVG9rZW4oYWNjLnRva2VuKTtjb25zdCBzaWduSD1nZXRTaWduKCJhcHAiLHt9LCcnLGNmZyk7Y29uc3QgcmVzPWF3YWl0IGh0dHBHZXQoImh0dHBzOi8vdGFwaS56ZWVob2V2LmNvbS92MS4wL2FwcC9jZm1vdG9zZXJ2ZXJhcHAvdmVoaWNsZS93aWRnZXRzLyIrZW5jb2RlVVJJQ29tcG9uZW50KHZpbk5vKSx7IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgIit0b2tlbiwiQ29udGVudC1UeXBlIjoiYXBwbGljYXRpb24vanNvbjtjaGFyc2V0PVVURi04IiwiaW50ZXJmYWNldmVyc2lvbiI6IjIiLCJ1c2VyX2lkIjphY2MudXNlcklkfHwiIiwuLi5zaWduSH0pO2lmKChyZXMuY29kZT09IjEwMDAwInx8cmVzLmNvZGU9PT0xMDAwMCkmJnJlcy5kYXRhKXtjb25zdCBkPXJlcy5kYXRhO2NvbnN0IHNvYz1OdW1iZXIoZC5ibXNzb2N8fGQuYmF0dGVyeUxldmVsfHwwKTtjb25zdCByYW5nZT1OdW1iZXIoZC5obWlSaWRhYmxlTWlsZXx8ZC52ZWhpY2xlUmlkYWJsZU1pbGV8fGQucmlkYWJsZU1pbGVhZ2V8fDApO2NvbnN0IHZvbHRhZ2U9TnVtYmVyKGQudm9sdGFnZXx8ZC5iYXR0ZXJ5Vm9sdGFnZXx8ZC5ibXNWb2x0YWdlfHxkLnRvdGFsVm9sdGFnZXx8ZC5iYXR0ZXJ5VG90YWxWb2x0YWdlfHwwKTtjb25zdCBsbmdTdHI9ZGVlcFBpY2soZCxbImxvbmdpdHVkZSIsImxuZyIsImxvbiIsImdwc1giLCJsb25naXR1ZGVWYWx1ZSIsImNvb3JkWCIsIngiXSk7Y29uc3QgbGF0U3RyPWRlZXBQaWNrKGQsWyJsYXRpdHVkZSIsImxhdCIsImdwc1kiLCJsYXRpdHVkZVZhbHVlIiwiY29vcmRZIiwieSJdKTtjb25zdCBsb25naXR1ZGU9TnVtYmVyKGxuZ1N0ciksbGF0aXR1ZGU9TnVtYmVyKGxhdFN0cik7cmV0dXJue2JhdHRlcnlQZXJjZW50Ok1hdGgubWF4KDAsTWF0aC5taW4oMTAwLGlzRmluaXRlKHNvYyk/c29jOjApKSxyZXNpZHVhbFJhbmdlS206aXNGaW5pdGUocmFuZ2UpP3JhbmdlOjAsdm9sdGFnZTppc0Zpbml0ZSh2b2x0YWdlKSYmdm9sdGFnZT4wP3ZvbHRhZ2U6MCxhZGRyZXNzOlN0cmluZyhkLmFkZHJlc3N8fCIiKS50cmltKCksbG9jYXRpb25UaW1lOlN0cmluZyhkLmxvY2F0aW9uPy5sb2NhdGlvblRpbWV8fCIiKS50cmltKCksdmVoaWNsZU5hbWU6U3RyaW5nKGQudmVoaWNsZU5hbWV8fCIiKS50cmltKCksdmVoaWNsZUltYWdlVXJsOlN0cmluZyhkLnZlaGljbGVTY2FsZVBpY1VybHx8ZC52ZWhpY2xlUGljVXJsfHwiIikudHJpbSgpLGhlYWRMb2NrU3RhdGU6U3RyaW5nKGQuaGVhZExvY2tTdGF0ZXx8IiIpLnRyaW0oKSxiYXR0ZXJ5UHVsbE91dDpTdHJpbmcoZC5iYXR0ZXJ5UHVsbE91dEZsYWd8fCIiKT09PSIxIixvbmxpbmU6U3RyaW5nKGQub25saW5lU3RhdHVzfHxkLm9ubGluZXx8ZC5uZXRTdGF0dXN8fGQudGJveFN0YXR1c3x8ZC5kZXZpY2VPbmxpbmV8fCIiKS50cmltKCksY3VzaGlvblN0YXRlOmRlZXBQaWNrKGQsWyJjdXNoaW9uU3RhdGUiLCJjdXNoaW9uU3RhdHVzIiwiY3VzaGlvbkxvY2tTdGF0ZSIsInNlYXRTdGF0ZSIsInNlYXRTdGF0dXMiLCJzZWF0TG9ja1N0YXRlIiwic2FkZGxlU3RhdGUiLCJzYWRkbGVTdGF0dXMiLCJzYWRkbGVMb2NrU3RhdGUiXSksbG9uZ2l0dWRlOihpc0Zpbml0ZShsb25naXR1ZGUpJiZNYXRoLmFicyhsb25naXR1ZGUpPD0xODAmJmxvbmdpdHVkZSE9PTApP2xvbmdpdHVkZToiIixsYXRpdHVkZTooaXNGaW5pdGUobGF0aXR1ZGUpJiZNYXRoLmFicyhsYXRpdHVkZSk8PTkwJiZsYXRpdHVkZSE9PTApP2xhdGl0dWRlOiIiLHBvd2VyU3RhdHVzOlN0cmluZyhkLmFjY1N0YXR1c3x8ZC5wb3dlclN0YXR1c3x8ZC52ZWhpY2xlU3RhdHVzfHxkLmlnbml0aW9uU3RhdHVzfHxkLnBvd2VyTW9kZXx8ZC5hY2NTdGF0ZXx8ZC5wb3dlclN0YXRlfHxkLnZlaGljbGVTdGF0ZXx8ZC5lbmdpbmVTdGF0dXN8fGQuaXNQb3dlck9ufHxkLnBvd2VyT258fCIiKS50cmltKCksbG9ja1N0YXRlOlN0cmluZyhkLmhlYWRMb2NrU3RhdGV8fGQubG9ja1N0YXRlfHxkLmxvY2tTdGF0dXN8fGQudmVoaWNsZUxvY2tTdGF0ZXx8ZC5jYXJMb2NrU3RhdGV8fGQuZG9vckxvY2tTdGF0ZXx8ZC5sb2NrRmxhZ3x8ZC5pc0xvY2tlZHx8ZC5sb2NrZWR8fGQuY2VudHJhbExvY2tpbmdTdGF0dXN8fCIiKS50cmltKCl9fXJldHVybiBudWxsfWNhdGNoKGUpe3JldHVybiBudWxsfX0KCmFzeW5jIGZ1bmN0aW9uIGZldGNoVmVoaWNsZUhvbWVQYWdlKGFjYyxjZmcsdmluTm8pe3RyeXtjb25zdCB0b2tlbj1jbGVhblRva2VuKGFjYy50b2tlbik7Y29uc3Qgc2lnbkg9Z2V0U2lnbigiYXBwIix7fSwnJyxjZmcpO2NvbnN0IGRldmljZUlkPWdldERldmljZUlkZW50aWZ5KGFjYyk7Y29uc3QgaGVhZGVycz17IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgIit0b2tlbiwiQ29udGVudC1UeXBlIjoiYXBwbGljYXRpb24vanNvbjtjaGFyc2V0PVVURi04IiwiaW50ZXJmYWNldmVyc2lvbiI6IjIiLCJ1c2VyX2lkIjphY2MudXNlcklkfHwiIiwuLi5zaWduSH07Y29uc3QgdXJsPSJodHRwczovL3RhcGkuemVlaG9ldi5jb20vdjEuMC9hcHAvY2Ztb3Rvc2VydmVyYXBwL3ZlaGljbGVIb21lUGFnZVYyLyIrZW5jb2RlVVJJQ29tcG9uZW50KHZpbk5vKSsiP3VuaXF1ZUlkZW50aWZ5PSIrZGV2aWNlSWQrIiZwaG9uZURldmljZU5hbWU9aW9zXyIrZGV2aWNlSWQ7Y29uc3QgcmVzPWF3YWl0IGh0dHBHZXQodXJsLGhlYWRlcnMpO2lmKHJlcyYmKHJlcy5jb2RlPT0iMTAwMDAifHxyZXMuY29kZT09PTEwMDAwKSYmcmVzLmRhdGEpe2NvbnN0IGQ9cmVzLmRhdGE7Y29uc3QgdmVoaWNsZUxvY2s9cGlja0lvdFByb3AoZCwiVmVoaWNsZUxvY2tfUyIpO2NvbnN0IGhlYWRMb2NrSW90PXBpY2tJb3RQcm9wKGQsIkhlYWRMb2NrU3RhdGUiKTtjb25zdCB0b3BMb2NrPVN0cmluZyhkLmhlYWRMb2NrU3RhdGV8fGQubG9ja1N0YXRlfHxkLmxvY2tTdGF0dXN8fGQudmVoaWNsZUxvY2tTdGF0ZXx8aGVhZExvY2tJb3R8fHZlaGljbGVMb2NrfHwiIikudHJpbSgpO2NvbnN0IGxuZ1N0cj1kZWVwUGljayhkLFsibG9uZ2l0dWRlIiwibG5nIiwibG9uIiwiZ3BzWCIsImxvbmdpdHVkZVZhbHVlIiwiY29vcmRYIiwieCJdKTtjb25zdCBsYXRTdHI9ZGVlcFBpY2soZCxbImxhdGl0dWRlIiwibGF0IiwiZ3BzWSIsImxhdGl0dWRlVmFsdWUiLCJjb29yZFkiLCJ5Il0pO2NvbnN0IGxvbmdpdHVkZT1OdW1iZXIobG5nU3RyKSxsYXRpdHVkZT1OdW1iZXIobGF0U3RyKTtyZXR1cm57cG93ZXJTdGF0dXM6ZGVlcFBpY2soZCxbImFjY1N0YXR1cyIsInBvd2VyU3RhdHVzIiwidmVoaWNsZVN0YXR1cyIsImlnbml0aW9uU3RhdHVzIiwicG93ZXJNb2RlIiwiYWNjU3RhdGUiLCJwb3dlclN0YXRlIiwidmVoaWNsZVN0YXRlIiwiZW5naW5lU3RhdHVzIiwiaXNQb3dlck9uIiwicG93ZXJPbiIsImFjYyJdKS50cmltKCksbG9ja1N0YXRlOnRvcExvY2ssb25saW5lOlN0cmluZyhkLm9ubGluZVN0YXR1c3x8ZC5yaWRlU3RhdGV8fGQub25saW5lfHxkLm5ldFN0YXR1c3x8ZC50Ym94U3RhdHVzfHwiIikudHJpbSgpLHJpZGVTdGF0ZTpTdHJpbmcoZC5yaWRlU3RhdGV8fCIiKS50cmltKCksY3VzaGlvblN0YXRlOmRlZXBQaWNrKGQsWyJjdXNoaW9uU3RhdGUiLCJjdXNoaW9uU3RhdHVzIiwiY3VzaGlvbkxvY2tTdGF0ZSIsInNlYXRTdGF0ZSIsInNlYXRTdGF0dXMiLCJzZWF0TG9ja1N0YXRlIiwic2FkZGxlU3RhdGUiLCJzYWRkbGVTdGF0dXMiLCJzYWRkbGVMb2NrU3RhdGUiXSksbG9uZ2l0dWRlOihpc0Zpbml0ZShsb25naXR1ZGUpJiZNYXRoLmFicyhsb25naXR1ZGUpPD0xODAmJmxvbmdpdHVkZSE9PTApP2xvbmdpdHVkZToiIixsYXRpdHVkZTooaXNGaW5pdGUobGF0aXR1ZGUpJiZNYXRoLmFicyhsYXRpdHVkZSk8PTkwJiZsYXRpdHVkZSE9PTApP2xhdGl0dWRlOiIifX1yZXR1cm4gbnVsbH1jYXRjaChlKXtyZXR1cm4gbnVsbH19Cgphc3luYyBmdW5jdGlvbiBmZXRjaFRpcmVQcmVzc3VyZShhY2MsY2ZnLHZpbk5vKXt0cnl7Y29uc3QgdG9rZW49Y2xlYW5Ub2tlbihhY2MudG9rZW4pO2NvbnN0IHNpZ25IPWdldFNpZ24oImFwcCIse30sJycsY2ZnKTtjb25zdCByZXM9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvYXBwL2NmbW90b3NlcnZlcmFwcC9hcHAvdmVoaWNsZS90aXJlL21vbml0b3Jpbmc/dmluTm89IitlbmNvZGVVUklDb21wb25lbnQodmluTm8pKyImdGltZVBlcmlvZFR5cGU9MSIseyJBdXRob3JpemF0aW9uIjoiQmVhcmVyICIrdG9rZW4sIkNvbnRlbnQtVHlwZSI6ImFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD1VVEYtOCIsImludGVyZmFjZXZlcnNpb24iOiIyIiwidXNlcl9pZCI6YWNjLnVzZXJJZHx8IiIsLi4uc2lnbkh9KTtpZigocmVzLmNvZGU9PSIxMDAwMCJ8fHJlcy5jb2RlPT09MTAwMDApJiZyZXMuZGF0YSl7Y29uc3QgbGlzdD1BcnJheS5pc0FycmF5KHJlcy5kYXRhLnJlYWxUaW1lRGF0YSk/cmVzLmRhdGEucmVhbFRpbWVEYXRhOihBcnJheS5pc0FycmF5KHJlcy5kYXRhKT9yZXMuZGF0YTpbXSk7Y29uc3QgYnlQb3M9e307Zm9yKGNvbnN0IGl0IG9mIGxpc3Qpe2NvbnN0IHBvcz1OdW1iZXIoaXQ/LnNlbnNvclBvc2l0aW9uKTtpZihwb3MpYnlQb3NbcG9zXT1pdH1jb25zdCBmbXQ9KGl0KT0+e2NvbnN0IHdhcm49TnVtYmVyKGl0Py53YXJuaW5nVHlwZT8/MCk7Y29uc3Qgdj1TdHJpbmcoaXQ/LnRpcmVQcmVzc3VyZT8/IiIpLnRyaW0oKTtjb25zdCBuPXBhcnNlRmxvYXQodik7aWYod2FybiE9PTB8fCF2fHwhaXNGaW5pdGUobil8fG48PTApcmV0dXJuIuacque7keWumiI7cmV0dXJuIHYrImJhciJ9O2NvbnN0IGZtdFRlbXA9KGl0KT0+e2NvbnN0IHdhcm49TnVtYmVyKGl0Py53YXJuaW5nVHlwZT8/MCk7Y29uc3Qgdj1pdD8udGlyZVRlbXA7aWYod2FybiE9PTB8fHY9PW51bGwpcmV0dXJuIiI7Y29uc3Qgcz1TdHJpbmcodikudHJpbSgpO2NvbnN0IG49cGFyc2VGbG9hdChzKTtpZighc3x8cy50b0xvd2VyQ2FzZSgpPT09Im51bGwifHwhaXNGaW5pdGUobil8fG48PTApcmV0dXJuIiI7cmV0dXJuIHMrIsKwQyJ9O2NvbnN0IGZyb250PWJ5UG9zWzFdfHxsaXN0WzBdO2NvbnN0IHJlYXI9YnlQb3NbMl18fGxpc3RbMV07cmV0dXJue2Zyb250UHJlc3N1cmU6ZnJvbnQ/Zm10KGZyb250KToi5pyq57uR5a6aIixyZWFyUHJlc3N1cmU6cmVhcj9mbXQocmVhcik6Iuacque7keWumiIsZnJvbnRUZW1wOmZyb250P2ZtdFRlbXAoZnJvbnQpOiIiLHJlYXJUZW1wOnJlYXI/Zm10VGVtcChyZWFyKToiIn19cmV0dXJuIG51bGx9Y2F0Y2goZSl7cmV0dXJuIG51bGx9fQoKYXN5bmMgZnVuY3Rpb24gZmV0Y2hSaWRlSW5mbyhhY2MsY2ZnLHZpbk5vKXt0cnl7Y29uc3QgdG9rZW49Y2xlYW5Ub2tlbihhY2MudG9rZW4pO2NvbnN0IHNpZ25IPWdldFNpZ24oImFwcCIse30sJycsY2ZnKTtjb25zdCBtb250aD1uZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCkrIi4iK1N0cmluZyhuZXcgRGF0ZSgpLmdldE1vbnRoKCkrMSkucGFkU3RhcnQoMiwiMCIpO2NvbnN0IFtob21lUmVzLG15UmVzXT1hd2FpdCBQcm9taXNlLmFsbChbaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvYXBwL2NmbW90b3NlcnZlcmFwcC9ob21lUmlkZUluZm8/dmluTm89IitlbmNvZGVVUklDb21wb25lbnQodmluTm8pLHsiQXV0aG9yaXphdGlvbiI6IkJlYXJlciAiK3Rva2VuLCJDb250ZW50LVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9VVRGLTgiLCJpbnRlcmZhY2V2ZXJzaW9uIjoiMiIsInVzZXJfaWQiOmFjYy51c2VySWR8fCIiLC4uLnNpZ25IfSksaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvYXBwL2NmbW90b3NlcnZlcmFwcC9teVJpZGVJbmZvP3Zpbk5vPSIrZW5jb2RlVVJJQ29tcG9uZW50KHZpbk5vKSsiJm1vbnRoPSIrbW9udGgseyJBdXRob3JpemF0aW9uIjoiQmVhcmVyICIrdG9rZW4sIkNvbnRlbnQtVHlwZSI6ImFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD1VVEYtOCIsImludGVyZmFjZXZlcnNpb24iOiIyIiwidXNlcl9pZCI6YWNjLnVzZXJJZHx8IiIsLi4uc2lnbkh9KV0pO2NvbnN0IGg9aG9tZVJlcz8uZGF0YXx8aG9tZVJlc3x8e307Y29uc3QgZD1teVJlcz8uZGF0YXx8bXlSZXN8fHt9O2NvbnN0IGxpc3Q9QXJyYXkuaXNBcnJheShkLnJpZGVSZWNvcmRMaXN0KT9kLnJpZGVSZWNvcmRMaXN0OltdO2NvbnN0IHRvZGF5S2V5PW5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKSsiLiIrU3RyaW5nKG5ldyBEYXRlKCkuZ2V0TW9udGgoKSsxKS5wYWRTdGFydCgyLCIwIikrIi4iK1N0cmluZyhuZXcgRGF0ZSgpLmdldERhdGUoKSkucGFkU3RhcnQoMiwiMCIpO2NvbnN0IGRheT1saXN0LmZpbmQoeD0+U3RyaW5nKHg/LmRhdGV8fCIiKT09PXRvZGF5S2V5KXx8bGlzdFtsaXN0Lmxlbmd0aC0xXXx8e307cmV0dXJue3RvZGF5RGlzdGFuY2U6TnVtYmVyKGRheS5yaWRlTWlsZWFnZT8/aC5yaWRlTWlsZWFnZURheT8/MCksdG9kYXlEdXJhdGlvbjpOdW1iZXIoZGF5LnJpZGluZ1RpbWVEYXlVbml0TWludXRlPz9oLmxhc3RSaWRpbmdUaW1lVW5pdE1pbnV0ZT8/MCksdG9kYXlNYXhTcGVlZDpOdW1iZXIoZGF5Lm1heFNwZWVkPz8wKSxsYXN0UmlkZU1pbGVhZ2U6TnVtYmVyKGgubGFzdFJpZGVNaWxlYWdlPz8wKSxsYXN0UmlkZUR1cmF0aW9uOk51bWJlcihoLmxhc3RSaWRpbmdUaW1lVW5pdE1pbnV0ZT8/MCl9fWNhdGNoKGUpe3JldHVybiBudWxsfX0KCmFzeW5jIGZ1bmN0aW9uIGZldGNoQmF0dGVyeUNoYXJnZVN0YXRlKGFjYyxjZmcsdmluTm8pe3RyeXtjb25zdCB0b2tlbj1jbGVhblRva2VuKGFjYy50b2tlbik7Y29uc3Qgc2lnbkg9Z2V0U2lnbigiYXBwIix7fSwnJyxjZmcpO2NvbnN0IGhlYWRlcnM9eyJBdXRob3JpemF0aW9uIjoiQmVhcmVyICIrdG9rZW4sIkNvbnRlbnQtVHlwZSI6ImFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD1VVEYtOCIsImludGVyZmFjZXZlcnNpb24iOiIyIiwiYXBwaWQiOmNmZy5hcHAuYXBwSWQsInVzZXJfaWQiOmFjYy51c2VySWR8fCIiLC4uLnNpZ25IfTtjb25zdCByZXM9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvYXBwL2NmbW90b3NlcnZlcmFwcC9iYXR0ZXJ5SW5mby8iK2VuY29kZVVSSUNvbXBvbmVudCh2aW5ObyksaGVhZGVycyk7aWYocmVzLmNvZGU9PSIxMDAwMCImJnJlcy5kYXRhKXtjb25zdCBkPXJlcy5kYXRhO2NvbnN0IHZvbHRhZ2U9TnVtYmVyKGQudm9sdGFnZXx8ZC5iYXR0ZXJ5Vm9sdGFnZXx8ZC5ibXNWb2x0YWdlfHxkLnRvdGFsVm9sdGFnZXx8ZC5iYXR0ZXJ5VG90YWxWb2x0YWdlfHxkLnZvbHx8ZC5iYXRWb2x0YWdlfHxkLmJhdHRlcnlWb2x8fDApO2NvbnN0IGN1cnJlbnQ9TnVtYmVyKGQuY3VycmVudHx8ZC5iYXR0ZXJ5Q3VycmVudHx8ZC5ibXNDdXJyZW50fHxkLmN1cnx8ZC5iYXR0ZXJ5Q3VyfHwwKTtjb25zdCBiYXR0ZXJ5VGVtcD1OdW1iZXIoZC5iYXR0ZXJ5VGVtcHx8ZC5iYXRUZW1wfHxkLnRlbXB8fGQudGVtcGVyYXR1cmV8fGQuYm1zVGVtcHx8ZC5iYXR0ZXJ5VGVtcGVyYXR1cmV8fDApO2NvbnN0IHJhbmdlPU51bWJlcihkLmhtaVJpZGFibGVNaWxlfHxkLnZlaGljbGVSaWRhYmxlTWlsZXx8ZC5yaWRhYmxlTWlsZWFnZXx8ZC5yZXNpZHVhbFJhbmdlfHwwKTtyZXR1cm57Y2hhcmdlU3RhdGU6U3RyaW5nKGQuY2hhcmdlU3RhdGVTdHJ8fGQuY2hhcmdlU3RhdGV8fCLmnKrlhYXnlLUiKSx2b2x0YWdlOmlzRmluaXRlKHZvbHRhZ2UpJiZ2b2x0YWdlPjA/dm9sdGFnZTowLGN1cnJlbnQ6aXNGaW5pdGUoY3VycmVudCk/Y3VycmVudDowLGJhdHRlcnlUZW1wOmlzRmluaXRlKGJhdHRlcnlUZW1wKT9iYXR0ZXJ5VGVtcDowLHNvYzpOdW1iZXIoZC5zb2N8fGQuYmF0dGVyeUxldmVsfHxkLmJtc3NvY3x8MCkscmVzaWR1YWxSYW5nZUttOmlzRmluaXRlKHJhbmdlKT9yYW5nZTowfX1yZXR1cm57Y2hhcmdlU3RhdGU6IuacquWFheeUtSIsdm9sdGFnZTowLGN1cnJlbnQ6MCxiYXR0ZXJ5VGVtcDowLHNvYzowLHJlc2lkdWFsUmFuZ2VLbTowfX1jYXRjaChlKXtyZXR1cm57Y2hhcmdlU3RhdGU6IuacquWFheeUtSIsdm9sdGFnZTowLGN1cnJlbnQ6MCxiYXR0ZXJ5VGVtcDowLHNvYzowLHJlc2lkdWFsUmFuZ2VLbTowfX19Cgphc3luYyBmdW5jdGlvbiBmZXRjaFNlcnZpY2VSZWNoYXJnZURldGFpbChhY2MsY2ZnLHZpbk5vKXt0cnl7Y29uc3QgdG9rZW49Y2xlYW5Ub2tlbihhY2MudG9rZW4pO2NvbnN0IHNpZ25IPWdldFNpZ24oImg1Iix7dmluTm86dmluTm99LCcnLGNmZyk7Y29uc3QgaGVhZGVycz17IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgIit0b2tlbiwiQ29udGVudC1UeXBlIjoiYXBwbGljYXRpb24vanNvbjtjaGFyc2V0PVVURi04IiwiaW50ZXJmYWNldmVyc2lvbiI6IjIiLC4uLnNpZ25IfTtpZihhY2MudXNlcklkKWhlYWRlcnNbInVzZXJfaWQiXT1TdHJpbmcoYWNjLnVzZXJJZCk7Y29uc3QgcmVzPWF3YWl0IGh0dHBHZXQoImh0dHBzOi8vaDUuemVlaG9ldi5jb20vY2Ztb3Rvc2VydmVyYXBwL2FwcC9zZXJ2aWNlL3JlY2hhcmdlL3ZlaGljbGUvZGV0YWlsP3Zpbk5vPSIrZW5jb2RlVVJJQ29tcG9uZW50KHZpbk5vKSxoZWFkZXJzKTtpZihyZXMuY29kZT09IjEwMDAwIiYmcmVzLmRhdGEpe3JldHVybntyZWNoYXJnZUVuZERhdGU6U3RyaW5nKHJlcy5kYXRhLnJlY2hhcmdlRW5kRGF0ZXx8IiIpLGxhc3RVc2VEYXRlOk51bWJlcihyZXMuZGF0YS5sYXN0VXNlRGF0ZSl8fDAsc2VydmljZVJlY2hhcmdlU3RhdHVzOlN0cmluZyhyZXMuZGF0YS5zZXJ2aWNlUmVjaGFyZ2VTdGF0dXN8fCIiKSx2ZWhpY2xlTmFtZTpTdHJpbmcocmVzLmRhdGEudmVoaWNsZU5hbWV8fCIiKX19cmV0dXJuIG51bGx9Y2F0Y2goZSl7cmV0dXJuIG51bGx9fQoKYXN5bmMgZnVuY3Rpb24gZmV0Y2hWZWhpY2xlSW5mbyhhY2MsY2ZnKXtjb25zdCByZXN1bHQ9e2hhc1ZlaGljbGU6ZmFsc2UsdmVoaWNsZU5hbWU6IiIsdmluTm86IiIsdm9sdGFnZTowLGN1cnJlbnQ6MCxiYXR0ZXJ5VGVtcDowLGJhdHRlcnlQZXJjZW50OjAscmVzaWR1YWxSYW5nZUttOjAscmFuZ2VFc3RpbWF0ZWQ6ZmFsc2UsYWRkcmVzczoiIixsb2NhdGlvblRpbWU6IiIsY2hhcmdlU3RhdGU6IuacquWFheeUtSIsZnJvbnRQcmVzc3VyZToiIixyZWFyUHJlc3N1cmU6IiIsZnJvbnRUZW1wOiIiLHJlYXJUZW1wOiIiLHRvZGF5RGlzdGFuY2U6MCx0b2RheUR1cmF0aW9uOjAsdG9kYXlNYXhTcGVlZDowLGxhc3RSaWRlTWlsZWFnZTowLHZlaGljbGVJbWFnZVVybDoiIixzZXJ2aWNlRW5kRGF0ZToiIixzZXJ2aWNlUmVtYWluRGF5czowLHNlcnZpY2VTdGF0dXM6IiIscG93ZXJTdGF0dXM6IiIsbG9ja1N0YXRlOiIiLG9ubGluZToiIixyaWRlU3RhdGU6IiIsY3VzaGlvblN0YXRlOiIiLGxvbmdpdHVkZToiIixsYXRpdHVkZToiIn07dHJ5e2NvbnN0IHZlaGljbGVzPWF3YWl0IGZldGNoVmVoaWNsZUxpc3QoYWNjLGNmZyk7aWYodmVoaWNsZXMubGVuZ3RoPT09MClyZXR1cm4gcmVzdWx0O2NvbnN0IHY9dmVoaWNsZXNbMF07cmVzdWx0Lmhhc1ZlaGljbGU9dHJ1ZTtyZXN1bHQudmVoaWNsZU5hbWU9di5uYW1lO3Jlc3VsdC52aW5Obz12LnZpbk5vO3Jlc3VsdC52ZWhpY2xlSW1hZ2VVcmw9di5waWM7Y29uc3QgW3dpZGdldHMsdGlyZSxyaWRlLGJhdHRlcnksc2VydmljZSxob21lUGFnZV09YXdhaXQgUHJvbWlzZS5hbGwoW2ZldGNoVmVoaWNsZVdpZGdldHMoYWNjLGNmZyx2LnZpbk5vKS5jYXRjaCgoKT0+bnVsbCksZmV0Y2hUaXJlUHJlc3N1cmUoYWNjLGNmZyx2LnZpbk5vKS5jYXRjaCgoKT0+bnVsbCksZmV0Y2hSaWRlSW5mbyhhY2MsY2ZnLHYudmluTm8pLmNhdGNoKCgpPT5udWxsKSxmZXRjaEJhdHRlcnlDaGFyZ2VTdGF0ZShhY2MsY2ZnLHYudmluTm8pLmNhdGNoKCgpPT4oe2NoYXJnZVN0YXRlOiLmnKrlhYXnlLUiLHZvbHRhZ2U6MCxjdXJyZW50OjAsYmF0dGVyeVRlbXA6MCxzb2M6MH0pKSxmZXRjaFNlcnZpY2VSZWNoYXJnZURldGFpbChhY2MsY2ZnLHYudmluTm8pLmNhdGNoKCgpPT5udWxsKSxmZXRjaFZlaGljbGVIb21lUGFnZShhY2MsY2ZnLHYudmluTm8pLmNhdGNoKCgpPT5udWxsKV0pO2lmKHdpZGdldHMpe3Jlc3VsdC5iYXR0ZXJ5UGVyY2VudD13aWRnZXRzLmJhdHRlcnlQZXJjZW50O3Jlc3VsdC5yZXNpZHVhbFJhbmdlS209d2lkZ2V0cy5yZXNpZHVhbFJhbmdlS207cmVzdWx0LnZvbHRhZ2U9d2lkZ2V0cy52b2x0YWdlO3Jlc3VsdC5hZGRyZXNzPXdpZGdldHMuYWRkcmVzcztyZXN1bHQubG9jYXRpb25UaW1lPXdpZGdldHMubG9jYXRpb25UaW1lO3Jlc3VsdC5wb3dlclN0YXR1cz13aWRnZXRzLnBvd2VyU3RhdHVzfHwiIjtyZXN1bHQubG9ja1N0YXRlPXdpZGdldHMubG9ja1N0YXRlfHwiIjtpZih3aWRnZXRzLnZlaGljbGVOYW1lKXJlc3VsdC52ZWhpY2xlTmFtZT13aWRnZXRzLnZlaGljbGVOYW1lO2lmKHdpZGdldHMudmVoaWNsZUltYWdlVXJsKXJlc3VsdC52ZWhpY2xlSW1hZ2VVcmw9d2lkZ2V0cy52ZWhpY2xlSW1hZ2VVcmw7aWYod2lkZ2V0cy5vbmxpbmUpcmVzdWx0Lm9ubGluZT13aWRnZXRzLm9ubGluZTtpZih3aWRnZXRzLmN1c2hpb25TdGF0ZSlyZXN1bHQuY3VzaGlvblN0YXRlPXdpZGdldHMuY3VzaGlvblN0YXRlO2lmKHdpZGdldHMubG9uZ2l0dWRlIT09IiImJndpZGdldHMubG9uZ2l0dWRlIT09dW5kZWZpbmVkKXJlc3VsdC5sb25naXR1ZGU9d2lkZ2V0cy5sb25naXR1ZGU7aWYod2lkZ2V0cy5sYXRpdHVkZSE9PSIiJiZ3aWRnZXRzLmxhdGl0dWRlIT09dW5kZWZpbmVkKXJlc3VsdC5sYXRpdHVkZT13aWRnZXRzLmxhdGl0dWRlfWlmKGhvbWVQYWdlKXtpZihob21lUGFnZS5wb3dlclN0YXR1cylyZXN1bHQucG93ZXJTdGF0dXM9aG9tZVBhZ2UucG93ZXJTdGF0dXM7aWYoaG9tZVBhZ2UubG9ja1N0YXRlKXJlc3VsdC5sb2NrU3RhdGU9aG9tZVBhZ2UubG9ja1N0YXRlO2lmKGhvbWVQYWdlLm9ubGluZSlyZXN1bHQub25saW5lPWhvbWVQYWdlLm9ubGluZTtpZihob21lUGFnZS5yaWRlU3RhdGUpcmVzdWx0LnJpZGVTdGF0ZT1ob21lUGFnZS5yaWRlU3RhdGU7aWYoaG9tZVBhZ2UuY3VzaGlvblN0YXRlKXJlc3VsdC5jdXNoaW9uU3RhdGU9aG9tZVBhZ2UuY3VzaGlvblN0YXRlO2lmKChyZXN1bHQubG9uZ2l0dWRlPT09IiJ8fHJlc3VsdC5sb25naXR1ZGU9PT11bmRlZmluZWQpJiZob21lUGFnZS5sb25naXR1ZGUhPT0iIiYmaG9tZVBhZ2UubG9uZ2l0dWRlIT09dW5kZWZpbmVkKXJlc3VsdC5sb25naXR1ZGU9aG9tZVBhZ2UubG9uZ2l0dWRlO2lmKChyZXN1bHQubGF0aXR1ZGU9PT0iInx8cmVzdWx0LmxhdGl0dWRlPT09dW5kZWZpbmVkKSYmaG9tZVBhZ2UubGF0aXR1ZGUhPT0iIiYmaG9tZVBhZ2UubGF0aXR1ZGUhPT11bmRlZmluZWQpcmVzdWx0LmxhdGl0dWRlPWhvbWVQYWdlLmxhdGl0dWRlfWlmKHRpcmUpe3Jlc3VsdC5mcm9udFByZXNzdXJlPXRpcmUuZnJvbnRQcmVzc3VyZTtyZXN1bHQucmVhclByZXNzdXJlPXRpcmUucmVhclByZXNzdXJlO3Jlc3VsdC5mcm9udFRlbXA9dGlyZS5mcm9udFRlbXA7cmVzdWx0LnJlYXJUZW1wPXRpcmUucmVhclRlbXB9aWYocmlkZSl7cmVzdWx0LnRvZGF5RGlzdGFuY2U9cmlkZS50b2RheURpc3RhbmNlO3Jlc3VsdC50b2RheUR1cmF0aW9uPXJpZGUudG9kYXlEdXJhdGlvbjtyZXN1bHQudG9kYXlNYXhTcGVlZD1yaWRlLnRvZGF5TWF4U3BlZWQ7cmVzdWx0Lmxhc3RSaWRlTWlsZWFnZT1yaWRlLmxhc3RSaWRlTWlsZWFnZX1yZXN1bHQuY2hhcmdlU3RhdGU9YmF0dGVyeS5jaGFyZ2VTdGF0ZXx8IuacquWFheeUtSI7aWYoYmF0dGVyeS52b2x0YWdlKXJlc3VsdC52b2x0YWdlPWJhdHRlcnkudm9sdGFnZTtpZihiYXR0ZXJ5LmN1cnJlbnQpcmVzdWx0LmN1cnJlbnQ9YmF0dGVyeS5jdXJyZW50O2lmKGJhdHRlcnkuYmF0dGVyeVRlbXApcmVzdWx0LmJhdHRlcnlUZW1wPWJhdHRlcnkuYmF0dGVyeVRlbXA7aWYoKCFyZXN1bHQucmVzaWR1YWxSYW5nZUttfHxyZXN1bHQucmVzaWR1YWxSYW5nZUttPT09MCkmJmJhdHRlcnkucmVzaWR1YWxSYW5nZUttKXJlc3VsdC5yZXNpZHVhbFJhbmdlS209YmF0dGVyeS5yZXNpZHVhbFJhbmdlS207aWYoKCFyZXN1bHQucmVzaWR1YWxSYW5nZUttfHxyZXN1bHQucmVzaWR1YWxSYW5nZUttPT09MCkmJnJlc3VsdC5iYXR0ZXJ5UGVyY2VudD4wKXtyZXN1bHQucmVzaWR1YWxSYW5nZUttPU1hdGgucm91bmQocmVzdWx0LmJhdHRlcnlQZXJjZW50KjAuODcpO3Jlc3VsdC5yYW5nZUVzdGltYXRlZD10cnVlfWlmKHNlcnZpY2Upe3Jlc3VsdC5zZXJ2aWNlRW5kRGF0ZT1zZXJ2aWNlLnJlY2hhcmdlRW5kRGF0ZXx8IiI7cmVzdWx0LnNlcnZpY2VTdGF0dXM9c2VydmljZS5zZXJ2aWNlUmVjaGFyZ2VTdGF0dXN8fCIiO3Jlc3VsdC5zZXJ2aWNlUmVtYWluRGF5cz1zZXJ2aWNlLmxhc3RVc2VEYXRlfHwwO2lmKHNlcnZpY2UudmVoaWNsZU5hbWUpcmVzdWx0LnZlaGljbGVOYW1lPXNlcnZpY2UudmVoaWNsZU5hbWV9fWNhdGNoKGUpe31yZXR1cm4gcmVzdWx0fQoKYXN5bmMgZnVuY3Rpb24gY2hlY2tUb2tlbihhY2MsY2ZnKXt0cnl7Y29uc3QgdG9rZW49Y2xlYW5Ub2tlbihhY2MudG9rZW4pO2NvbnN0IHVzZXJJZD1hY2MudXNlcklkfHwiIjtpZighdXNlcklkKXJldHVybnt2YWxpZDp0cnVlLHNjb3JlOjAsdXNlck5hbWU6YWNjLnVzZXJOYW1lfTtjb25zdCBzaWduSD1nZXRTaWduKCJhcHAiLHt9LCcnLGNmZyk7Y29uc3QgaGVhZGVycz17IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgIit0b2tlbiwiQ29udGVudC1UeXBlIjoiYXBwbGljYXRpb24vanNvbjtjaGFyc2V0PVVURi04IiwiaW50ZXJmYWNldmVyc2lvbiI6IjIiLCJ1c2VyX2lkIjp1c2VySWQsLi4uc2lnbkh9O2NvbnN0IHJlcz1hd2FpdCBodHRwR2V0KCJodHRwczovL3RhcGkuemVlaG9ldi5jb20vdjEuMC9taW5lL2NmbW90b3NlcnZlcm1pbmUvc2V0dGluZy8iK3VzZXJJZCxoZWFkZXJzKTtpZihyZXMuY29kZT09IjEwMDAwIiYmcmVzLmRhdGEpcmV0dXJue3ZhbGlkOnRydWUsc2NvcmU6TnVtYmVyKHJlcy5kYXRhLnNjb3JlKXx8MCx1c2VyTmFtZTpyZXMuZGF0YS5uaWNrTmFtZXx8YWNjLnVzZXJOYW1lfTtpZihyZXMuY29kZT09IjQwMDAxInx8cmVzLmNvZGU9PTQwMSlyZXR1cm57dmFsaWQ6ZmFsc2UscmVhc29uOiJ0b2tlbuW3sui/h+acnyJ9O3JldHVybnt2YWxpZDp0cnVlLHJlYXNvbjpyZXMubWVzc2FnZXx8Iuivt+axguW8guW4uCJ9fWNhdGNoKGUpe3JldHVybnt2YWxpZDp0cnVlLHJlYXNvbjpTdHJpbmcoZSl9fX0KCmFzeW5jIGZ1bmN0aW9uIGdldFVzZXJpZEJ5VG9rZW4odG9rZW4sY2ZnKXtjb25zdCB0PWNsZWFuVG9rZW4odG9rZW4pO2NvbnN0IGJhc2VIZWFkZXJzPXsiQXV0aG9yaXphdGlvbiI6IkJlYXJlciAiK3QsIkNvbnRlbnQtVHlwZSI6ImFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD1VVEYtOCIsImludGVyZmFjZXZlcnNpb24iOiIyIn07bGV0IHVzZXJJZD0iIix1c2VyTmFtZT0iIixlcnJvcj1udWxsO3RyeXtjb25zdCBzaWduSDA9Z2V0U2lnbigiaDUiLHtzZXJ2ZXJfbmFtZToiU01BUlQifSwnJyxjZmcpO2NvbnN0IHJlczA9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly9oNS56ZWVob2V2LmNvbS9jZm1vdG9zZXJ2ZXJtaW5lL2Jhc2VJbmZvP3NlcnZlcl9uYW1lPVNNQVJUIix7Li4uYmFzZUhlYWRlcnMsLi4uc2lnbkgwfSk7aWYocmVzMCYmU3RyaW5nKHJlczAuY29kZSk9PT0iMTAwMDAiJiZyZXMwLmRhdGEpe3VzZXJJZD1TdHJpbmcocmVzMC5kYXRhLmlkfHwiIik7dXNlck5hbWU9U3RyaW5nKHJlczAuZGF0YS5uaWNrTmFtZXx8IiIpfX1jYXRjaChlKXt9aWYoIXVzZXJJZCl7dHJ5e2NvbnN0IHNpZ25IPWdldFNpZ24oImFwcCIse30sJycsY2ZnKTtjb25zdCByZXM9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvbWluZS9jZm1vdG9zZXJ2ZXJtaW5lL3NldHRpbmciLHsuLi5iYXNlSGVhZGVycywuLi5zaWduSH0pO2lmKHJlcy5jb2RlPT0iMTAwMDAiJiZyZXMuZGF0YSl7dXNlcklkPVN0cmluZyhyZXMuZGF0YS5pZHx8cmVzLmRhdGEudXNlcklkfHwiIik7dXNlck5hbWU9U3RyaW5nKHJlcy5kYXRhLm5pY2tOYW1lfHwiIil9fWNhdGNoKGUpe319aWYoIXVzZXJJZCl7dHJ5e2NvbnN0IHNpZ25IPWdldFNpZ24oImFwcCIse30sJycsY2ZnKTtjb25zdCByZXM9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvYXBwL2NmbW90b3NlcnZlcmFwcC92ZWhpY2xlL2xpc3QiLHsuLi5iYXNlSGVhZGVycywuLi5zaWduSH0pO2NvbnN0IGZpbmQ9KG9iaixkZXB0aCk9PntpZighb2JqfHxkZXB0aD41KXJldHVybiIiO2Zvcihjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqKSl7Y29uc3QgdmFsPW9ialtrZXldO2lmKC91c2VyLj9pZHx1aWR8Y3JlYXRlLj9ieXxvd25lci4/aWQvaS50ZXN0KGtleSkmJnZhbCYmdHlwZW9mIHZhbCE9PSJvYmplY3QiKXtjb25zdCBzPVN0cmluZyh2YWwpO2lmKHMubGVuZ3RoPj0xMCYmL15cZCskLy50ZXN0KHMpKXJldHVybiBzfWlmKHZhbCYmdHlwZW9mIHZhbD09PSJvYmplY3QiKXtjb25zdCBmPWZpbmQodmFsLGRlcHRoKzEpO2lmKGYpcmV0dXJuIGZ9fXJldHVybiIifTtjb25zdCB1aWQ9ZmluZChyZXMsMCk7aWYodWlkKXt1c2VySWQ9dWlkO2NvbnN0IGZpbmROYW1lPShvYmosZGVwdGgpPT57aWYoIW9ianx8ZGVwdGg+NClyZXR1cm4iIjtmb3IoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9iaikpe2lmKC9uaWNrLj9uYW1lfHVzZXIuP25hbWUvaS50ZXN0KGtleSkmJm9ialtrZXldJiZ0eXBlb2Ygb2JqW2tleV09PT0ic3RyaW5nIilyZXR1cm4gb2JqW2tleV07aWYob2JqW2tleV0mJnR5cGVvZiBvYmpba2V5XT09PSJvYmplY3QiKXtjb25zdCBuPWZpbmROYW1lKG9ialtrZXldLGRlcHRoKzEpO2lmKG4pcmV0dXJuIG59fXJldHVybiIifTt1c2VyTmFtZT1maW5kTmFtZShyZXMsMCl9fWNhdGNoKGUpe319aWYoIXVzZXJJZCllcnJvcj0i6Ieq5Yqo6I635Y+W5aSx6LSl77yM6K+35omL5Yqo5aGr5YaZ55So5oi3SUQiO3JldHVybntvazohIXVzZXJJZCx1c2VySWQsdXNlck5hbWUsZXJyb3J9fQovKiA9PT09PT09PT09PT09PT09PSDotKblj7fmlbDmja7mi4nlj5YgPT09PT09PT09PT09PT09PT0gKi8KYXN5bmMgZnVuY3Rpb24gZmV0Y2hBY2NvdW50RGF0YShhY2MsY2ZnLHZpbk5vKXtjb25zdCB0b2tlbj1jbGVhblRva2VuKGFjYy50b2tlbik7bGV0IHVzZXJJZD1hY2MudXNlcklkfHwiIjtjb25zdCBub3c9bmV3IERhdGUoKTtjb25zdCB0b2RheT1ub3cuZ2V0RnVsbFllYXIoKSsiLSIrU3RyaW5nKG5vdy5nZXRNb250aCgpKzEpLnBhZFN0YXJ0KDIsIjAiKSsiLSIrU3RyaW5nKG5vdy5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIjAiKTtjb25zdCByZXN1bHQ9e3VzZXJOYW1lOmFjYy51c2VyTmFtZXx8IuacquefpeeUqOaItyIsdXNlcklkLHNjb3JlOjAsc2lnbmVkVG9kYXk6ZmFsc2UsY29udGludWVEYXlzOjAsdG9kYXlTY29yZTowLHNpZ25Db3VudDowLGxhc3Q3OltdLGVycm9yOm51bGwsdmVoaWNsZTp7aGFzVmVoaWNsZTpmYWxzZX19OwppZighdXNlcklkKXt0cnl7Y29uc3Qgc2lnbkg9Z2V0U2lnbigiYXBwIix7fSwnJyxjZmcpO2NvbnN0IHZlaGljbGVSZXM9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvYXBwL2NmbW90b3NlcnZlcmFwcC92ZWhpY2xlL2xpc3QiLHsiQXV0aG9yaXphdGlvbiI6IkJlYXJlciAiK3Rva2VuLCJDb250ZW50LVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9VVRGLTgiLCJpbnRlcmZhY2V2ZXJzaW9uIjoiMiIsLi4uc2lnbkh9KTtpZih2ZWhpY2xlUmVzLmNvZGU9PSIxMDAwMCImJnZlaGljbGVSZXMuZGF0YSl7Y29uc3QgYXV0b1VpZD1TdHJpbmcodmVoaWNsZVJlcy5kYXRhLnVzZXJJZHx8dmVoaWNsZVJlcy5kYXRhLnVpZHx8dmVoaWNsZVJlcy5kYXRhLmlkfHwiIik7aWYoYXV0b1VpZCl7dXNlcklkPWF1dG9VaWQ7cmVzdWx0LnVzZXJJZD11c2VySWQ7Y29uc3QgYWNjb3VudHM9Z2V0QWNjb3VudHMoKTtjb25zdCBpZHg9YWNjb3VudHMuZmluZEluZGV4KGE9PmNsZWFuVG9rZW4oYS50b2tlbik9PT10b2tlbik7aWYoaWR4Pj0wJiYhYWNjb3VudHNbaWR4XS51c2VySWQpe2FjY291bnRzW2lkeF0udXNlcklkPXVzZXJJZDtzYXZlQWNjb3VudHMoYWNjb3VudHMpfX19fWNhdGNoKGUpe319CnRyeXtyZXN1bHQudmVoaWNsZT1hd2FpdCBmZXRjaFZlaGljbGVJbmZvKGFjYyxjZmcsdmluTm8pfWNhdGNoKGUpe3Jlc3VsdC52ZWhpY2xlPXtoYXNWZWhpY2xlOmZhbHNlfX0KdHJ5e2lmKCF1c2VySWQpe3Jlc3VsdC5lcnJvcj0i6K+35Zyo6K6+572u6aG15aGr5YaZ55So5oi3SUQifWVsc2V7Y29uc3Qgc2lnbkg9Z2V0U2lnbigiYXBwIix7fSwnJyxjZmcpO2NvbnN0IGluZm9SZXM9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvbWluZS9jZm1vdG9zZXJ2ZXJtaW5lL3NldHRpbmcvIit1c2VySWQseyJBdXRob3JpemF0aW9uIjoiQmVhcmVyICIrdG9rZW4sIkNvbnRlbnQtVHlwZSI6ImFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD1VVEYtOCIsImludGVyZmFjZXZlcnNpb24iOiIyIiwidXNlcl9pZCI6dXNlcklkLC4uLnNpZ25IfSk7aWYoaW5mb1Jlcy5jb2RlPT0iMTAwMDAiJiZpbmZvUmVzLmRhdGEpe3Jlc3VsdC5zY29yZT1OdW1iZXIoaW5mb1Jlcy5kYXRhLnNjb3JlfHxpbmZvUmVzLmRhdGEuaW50ZWdyYWx8fGluZm9SZXMuZGF0YS5wb2ludHx8aW5mb1Jlcy5kYXRhLnBvaW50c3x8aW5mb1Jlcy5kYXRhLnRvdGFsU2NvcmV8fGluZm9SZXMuZGF0YS50b3RhbEludGVncmFsfHwwKX1lbHNlIGlmKGluZm9SZXMuY29kZT09IjQwMDAxInx8aW5mb1Jlcy5jb2RlPT00MDEpe3Jlc3VsdC5lcnJvcj0iVG9rZW7lt7Lov4fmnJ8ifWVsc2V7cmVzdWx0LmVycm9yPSLnp6/liIbojrflj5blpLHotKU6ICIrKGluZm9SZXMubWVzc2FnZXx8aW5mb1Jlcy5jb2RlfHwi5pyq55+l6ZSZ6K+vIil9fX1jYXRjaChlKXtpZighcmVzdWx0LmVycm9yKXJlc3VsdC5lcnJvcj0i56ev5YiG6I635Y+W5byC5bi4OiAiK1N0cmluZyhlKX0KdHJ5e2NvbnN0IGN1ck1vbnRoPW5vdy5nZXRGdWxsWWVhcigpKyItIisobm93LmdldE1vbnRoKCkrMSk7Y29uc3QgbGFzdERhdGU9bmV3IERhdGUobm93LmdldEZ1bGxZZWFyKCksbm93LmdldE1vbnRoKCktMSwxKTtjb25zdCBsYXN0TW9udGg9bGFzdERhdGUuZ2V0RnVsbFllYXIoKSsiLSIrKGxhc3REYXRlLmdldE1vbnRoKCkrMSk7Y29uc3QgYmFzZUhlYWRlcnM9eyJBdXRob3JpemF0aW9uIjoiQmVhcmVyICIrdG9rZW4sIkNvbnRlbnQtVHlwZSI6ImFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD1VVEYtOCIsImludGVyZmFjZXZlcnNpb24iOiIyIiwidXNlcl9pZCI6dXNlcklkfTtjb25zdCBbY3VyUmVzLGxhc3RSZXNdPWF3YWl0IFByb21pc2UuYWxsKFtodHRwR2V0KCJodHRwczovL2g1LnplZWhvZXYuY29tL2NmbW90b3NlcnZlcm1pbmUvc2lnbmluL2luZm8/bW9udGg9IitjdXJNb250aCx7Li4uYmFzZUhlYWRlcnMsLi4uZ2V0U2lnbigiaDUiLHttb250aDpjdXJNb250aH0sJycsY2ZnKX0pLGh0dHBHZXQoImh0dHBzOi8vaDUuemVlaG9ldi5jb20vY2Ztb3Rvc2VydmVybWluZS9zaWduaW4vaW5mbz9tb250aD0iK2xhc3RNb250aCx7Li4uYmFzZUhlYWRlcnMsLi4uZ2V0U2lnbigiaDUiLHttb250aDpsYXN0TW9udGh9LCcnLGNmZyl9KV0pO2NvbnN0IGxhc3RMaXN0PShsYXN0UmVzLmNvZGU9PSIxMDAwMCImJmxhc3RSZXMuZGF0YSk/KGxhc3RSZXMuZGF0YS5ub3dTaWduRGV0YWlsVm9zfHxbXSk6W107Y29uc3QgY3VyTGlzdD0oY3VyUmVzLmNvZGU9PSIxMDAwMCImJmN1clJlcy5kYXRhKT8oY3VyUmVzLmRhdGEubm93U2lnbkRldGFpbFZvc3x8W10pOltdO2NvbnN0IGxpc3Q9Wy4uLmxhc3RMaXN0LC4uLmN1ckxpc3RdO2lmKGN1clJlcy5jb2RlPT0iMTAwMDAiJiZjdXJSZXMuZGF0YSl7cmVzdWx0LnNpZ25Db3VudD1OdW1iZXIoY3VyUmVzLmRhdGEuc2lnbkNvdW50KXx8MH1jb25zdCB0b2RheUVudHJ5PWN1ckxpc3QuZmluZCh4PT54LmNyZWF0ZURhdGU9PT10b2RheSk7cmVzdWx0LnNpZ25lZFRvZGF5PSEhKHRvZGF5RW50cnkmJih0b2RheUVudHJ5LnNpZ25TdGF0dWU9PTN8fHRvZGF5RW50cnkuc2lnblN0YXR1ZT09NSkpO3Jlc3VsdC50b2RheVNjb3JlPXRvZGF5RW50cnk/KE51bWJlcih0b2RheUVudHJ5LmludGVncmFsU2NvcmUpfHwwKTowO3RyeXtjb25zdCBfdG9kYXlMb2dzPShnZXRMb2dzKCl8fFtdKS5maWx0ZXIobD0+bCYmbC5kYXRlPT09dG9kYXkmJlN0cmluZyhsLnVzZXJJZHx8IiIpPT09U3RyaW5nKHVzZXJJZCkmJmwuc3VjY2Vzcyk7aWYoX3RvZGF5TG9ncy5sZW5ndGg+MCl7Y29uc3QgX3RsPV90b2RheUxvZ3NbMF07cmVzdWx0LnRvZGF5U2NvcmU9TnVtYmVyKF90bC50b3RhbEdhaW4pfHxyZXN1bHQudG9kYXlTY29yZTtyZXN1bHQudG9kYXlEZXRhaWw9e3NpZ25pblNjb3JlOk51bWJlcihfdGwuc2lnbmluU2NvcmUpfHwwLGJsaW5kQm94U2NvcmU6TnVtYmVyKF90bC5ibGluZEJveFNjb3JlKXx8MCxpbnRlcmFjdFNjb3JlOk51bWJlcihfdGwuaW50ZXJhY3RTY29yZSl8fDB9fX1jYXRjaChlKXt9Y29uc3QgdG9kYXlJZHg9bGlzdC5maW5kSW5kZXgoeD0+eC5jcmVhdGVEYXRlPT09dG9kYXkpO2xldCBjb250PTA7aWYodG9kYXlJZHg+PTApe2ZvcihsZXQgaT10b2RheUlkeDtpPj0wO2ktLSl7Y29uc3Qgc3Q9bGlzdFtpXT8uc2lnblN0YXR1ZTtpZihzdD09M3x8c3Q9PTUpY29udCsrO2Vsc2UgYnJlYWt9fXJlc3VsdC5jb250aW51ZURheXM9Y29udDtmb3IobGV0IGk9NjtpPj0wO2ktLSl7Y29uc3QgZD1uZXcgRGF0ZSgpO2Quc2V0RGF0ZShkLmdldERhdGUoKS1pKTtjb25zdCBkcz1kLmdldEZ1bGxZZWFyKCkrIi0iK1N0cmluZyhkLmdldE1vbnRoKCkrMSkucGFkU3RhcnQoMiwiMCIpKyItIitTdHJpbmcoZC5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIjAiKTtjb25zdCBlbnRyeT1saXN0LmZpbmQoeD0+eC5jcmVhdGVEYXRlPT09ZHMpO3Jlc3VsdC5sYXN0Ny5wdXNoKHtkYXRlOmRzLnNsaWNlKDUpLHNpZ25lZDohIShlbnRyeSYmKGVudHJ5LnNpZ25TdGF0dWU9PTN8fGVudHJ5LnNpZ25TdGF0dWU9PTUpKSxpc1RvZGF5Omk9PT0wfSl9fWNhdGNoKGUpe2lmKCFyZXN1bHQuZXJyb3IpcmVzdWx0LmVycm9yPSLnrb7liLDnirbmgIHojrflj5blpLHotKUifQp0cnl7Y29uc3QgdG9rZW5DaGVjaz1hd2FpdCBjaGVja1Rva2VuKGFjYyxjZmcpO3Jlc3VsdC50b2tlblZhbGlkPXRva2VuQ2hlY2sudmFsaWQ7cmVzdWx0LnRva2VuUmVhc29uPXRva2VuQ2hlY2sucmVhc29ufHxudWxsO2lmKHRva2VuQ2hlY2sudmFsaWQmJnRva2VuQ2hlY2sudXNlck5hbWUmJighcmVzdWx0LnVzZXJOYW1lfHxyZXN1bHQudXNlck5hbWU9PT0i5pyq55+l55So5oi3IikpcmVzdWx0LnVzZXJOYW1lPXRva2VuQ2hlY2sudXNlck5hbWV9Y2F0Y2goZSl7cmVzdWx0LnRva2VuVmFsaWQ9dHJ1ZX0KcmV0dXJuIHJlc3VsdH0KCmZ1bmN0aW9uIGdldFBvc3RJZEZyb21EYXRhKGRhdGEpe2lmKCFkYXRhKXJldHVybiBudWxsO2lmKHR5cGVvZiBkYXRhPT09InN0cmluZyJ8fHR5cGVvZiBkYXRhPT09Im51bWJlciIpcmV0dXJuIFN0cmluZyhkYXRhKTtpZihBcnJheS5pc0FycmF5KGRhdGEpKXJldHVybiBnZXRQb3N0SWRGcm9tRGF0YShkYXRhWzBdKTtjb25zdCBkaXJlY3Q9ZGF0YS51dWlkfHxkYXRhLnR1dWlkfHxkYXRhLnBvc3RJZHx8ZGF0YS5wb3N0aWR8fGRhdGEuYXJ0aWNsZUlkfHxkYXRhLmFydGljbGVJRHx8ZGF0YS5pZHx8ZGF0YS5kYXRhSWR8fGRhdGEudGlkO2lmKGRpcmVjdClyZXR1cm4gU3RyaW5nKGRpcmVjdCk7Zm9yKGNvbnN0IGtleSBvZiBbInJlY29yZHMiLCJsaXN0Iiwicm93cyIsImRhdGEiLCJyZXN1bHQiXSl7Y29uc3Qgdj1kYXRhW2tleV07Y29uc3QgcGlkPWdldFBvc3RJZEZyb21EYXRhKHYpO2lmKHBpZClyZXR1cm4gcGlkfXJldHVybiBudWxsfQoKLyogPT09PT09PT09PT09PT09PT0g562+5Yiw5omn6KGMID09PT09PT09PT09PT09PT09ICovCmFzeW5jIGZ1bmN0aW9uIHJ1blNpZ25pbkZvckFjY291bnQoYWNjLGNmZyl7Y29uc3QgcmVzdWx0PXt1c2VyTmFtZTphY2MudXNlck5hbWV8fCLmnKrnn6UiLHVzZXJJZDphY2MudXNlcklkLHN1Y2Nlc3M6ZmFsc2Usc2lnbmluU2NvcmU6MCxibGluZEJveFNjb3JlOjAsaW50ZXJhY3RTY29yZTowLHRvdGFsR2FpbjowLGNvbnRpbnVlRGF5czowLGVycm9yOm51bGwsc3RlcHM6W119O3RyeXtjb25zdCB0b2tlbj1jbGVhblRva2VuKGFjYy50b2tlbik7Y29uc3QgdXNlcklkPWFjYy51c2VySWR8fCIiO2NvbnN0IGJhc2VIZWFkZXJzPXsiQXV0aG9yaXphdGlvbiI6IkJlYXJlciAiK3Rva2VuLCJDb250ZW50LVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9VVRGLTgiLCJpbnRlcmZhY2V2ZXJzaW9uIjoiMiIsInVzZXJfaWQiOnVzZXJJZH07Y29uc3Qgbm93PW5ldyBEYXRlKCk7Y29uc3QgdG9kYXk9bm93LmdldEZ1bGxZZWFyKCkrIi0iK1N0cmluZyhub3cuZ2V0TW9udGgoKSsxKS5wYWRTdGFydCgyLCIwIikrIi0iK1N0cmluZyhub3cuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCIwIik7Y29uc3QgbW9udGg9dG9kYXkuc2xpY2UoMCw3KTsKdHJ5e2NvbnN0IGluZm9SZXM9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly9oNS56ZWVob2V2LmNvbS9jZm1vdG9zZXJ2ZXJtaW5lL3NpZ25pbi9pbmZvP21vbnRoPSIrbW9udGgsey4uLmJhc2VIZWFkZXJzLC4uLmdldFNpZ24oImg1Iix7bW9udGh9LCcnLGNmZyl9KTtjb25zdCB0b2RheUVudHJ5PShpbmZvUmVzPy5kYXRhPy5ub3dTaWduRGV0YWlsVm9zfHxbXSkuZmluZCh4PT54LmNyZWF0ZURhdGU9PT10b2RheSk7aWYodG9kYXlFbnRyeSYmKHRvZGF5RW50cnkuc2lnblN0YXR1ZT09M3x8dG9kYXlFbnRyeS5zaWduU3RhdHVlPT01KSl7cmVzdWx0LnN0ZXBzLnB1c2goIuS7iuaXpeW3suetvuWIsCIpfWVsc2V7bGV0IHNpZ25SZXM9bnVsbCxzaWduTXNnPSLmnKrnn6UiO2ZvcihsZXQgYXQ9MTthdDw9MzthdCsrKXtzaWduUmVzPWF3YWl0IGh0dHBQb3N0KCJodHRwczovL2g1LnplZWhvZXYuY29tL2NmbW90b3NlcnZlcm1pbmUvc2lnbmluIix7Li4uYmFzZUhlYWRlcnMsLi4uZ2V0U2lnbigiaDUiLHt9LCcnLGNmZyl9LHt9KTtpZihzaWduUmVzPy5jb2RlPT0iMTAwMDAiKWJyZWFrO3NpZ25Nc2c9c2lnblJlcz8ubWVzc2FnZXx8IuacquefpSI7aWYoL+ivt+eojXznqI3lkI5856iN5YCZfOmikee5gXznuYHlv5l86YeN6K+VLy50ZXN0KHNpZ25Nc2cpJiZhdDwzKXthd2FpdCBuZXcgUHJvbWlzZShyPT5zZXRUaW1lb3V0KHIsKGF0KzEpKjIwMDApKTtjb250aW51ZX1icmVha31pZihzaWduUmVzPy5jb2RlPT0iMTAwMDAiKXtjb25zdCBpbmZvUmVzMj1hd2FpdCBodHRwR2V0KCJodHRwczovL2g1LnplZWhvZXYuY29tL2NmbW90b3NlcnZlcm1pbmUvc2lnbmluL2luZm8/bW9udGg9Iittb250aCx7Li4uYmFzZUhlYWRlcnMsLi4uZ2V0U2lnbigiaDUiLHttb250aH0sJycsY2ZnKX0pO2NvbnN0IHRlPShpbmZvUmVzMj8uZGF0YT8ubm93U2lnbkRldGFpbFZvc3x8W10pLmZpbmQoeD0+eC5jcmVhdGVEYXRlPT09dG9kYXkpO3Jlc3VsdC5zaWduaW5TY29yZT10ZT8oTnVtYmVyKHRlLmludGVncmFsU2NvcmUpfHwwKTowO3Jlc3VsdC5zdGVwcy5wdXNoKCLnrb7liLDmiJDlip8gKyIrcmVzdWx0LnNpZ25pblNjb3JlKX1lbHNle3RyeXtjb25zdCBjaGs9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly9oNS56ZWVob2V2LmNvbS9jZm1vdG9zZXJ2ZXJtaW5lL3NpZ25pbi9pbmZvP21vbnRoPSIrbW9udGgsey4uLmJhc2VIZWFkZXJzLC4uLmdldFNpZ24oImg1Iix7bW9udGh9LCcnLGNmZyl9KTtjb25zdCBjZT0oY2hrPy5kYXRhPy5ub3dTaWduRGV0YWlsVm9zfHxbXSkuZmluZCh4PT54LmNyZWF0ZURhdGU9PT10b2RheSk7aWYoY2UmJihjZS5zaWduU3RhdHVlPT0zfHxjZS5zaWduU3RhdHVlPT01KSlyZXN1bHQuc3RlcHMucHVzaCgi5LuK5pel5bey562+5YiwIik7ZWxzZSByZXN1bHQuc3RlcHMucHVzaCgi562+5Yiw5aSx6LSlOiAiK3NpZ25Nc2cpfWNhdGNoKGUpe3Jlc3VsdC5zdGVwcy5wdXNoKCLnrb7liLDlpLHotKU6ICIrc2lnbk1zZyl9fX0KfWNhdGNoKGUpe3Jlc3VsdC5zdGVwcy5wdXNoKCLnrb7liLDlvILluLg6ICIrZSl9CnRyeXtjb25zdCBpbmZvUmVzPWF3YWl0IGh0dHBHZXQoImh0dHBzOi8vaDUuemVlaG9ldi5jb20vY2Ztb3Rvc2VydmVybWluZS9zaWduaW4vaW5mbz9tb250aD0iK21vbnRoLHsuLi5iYXNlSGVhZGVycywuLi5nZXRTaWduKCJoNSIse21vbnRofSwnJyxjZmcpfSk7Y29uc3QgbGlzdD1pbmZvUmVzPy5kYXRhPy5ub3dTaWduRGV0YWlsVm9zfHxbXTtjb25zdCB0b2RheUlkeD1saXN0LmZpbmRJbmRleCh4PT54LmNyZWF0ZURhdGU9PT10b2RheSk7bGV0IGNvbnQ9MDtmb3IobGV0IGk9dG9kYXlJZHg7aT49MDtpLS0pe2lmKGxpc3RbaV0/LnNpZ25TdGF0dWU9PTN8fGxpc3RbaV0/LnNpZ25TdGF0dWU9PTUpY29udCsrO2Vsc2UgYnJlYWt9cmVzdWx0LmNvbnRpbnVlRGF5cz1jb250O2NvbnN0IHNpZ25Db3VudD1OdW1iZXIoaW5mb1Jlcz8uZGF0YT8uc2lnbkNvdW50KXx8MDtpZihzaWduQ291bnQ+PTMwKXtjb25zdCBibGluZFJlcz1hd2FpdCBodHRwR2V0KCJodHRwczovL2g1LnplZWhvZXYuY29tL2NmbW90b3NlcnZlcm1pbmUvc2lnbmluL3N1cHBsZW1lbnRQcml6ZT9zdXBwbGVtZW50RGF0ZT0iK3RvZGF5LHsuLi5iYXNlSGVhZGVycywuLi5nZXRTaWduKCJoNSIse3N1cHBsZW1lbnREYXRlOnRvZGF5fSwnJyxjZmcpfSk7aWYoYmxpbmRSZXM/LmNvZGU9PSIxMDAwMCIpe3Jlc3VsdC5ibGluZEJveFNjb3JlPU51bWJlcihibGluZFJlcz8uZGF0YT8uaW50ZWdyYWx8fGJsaW5kUmVzPy5kYXRhPy5pbnRlZ3JhbFNjb3JlfHwwKTtyZXN1bHQuc3RlcHMucHVzaCgi55uy55uS6I635b6XICsiK3Jlc3VsdC5ibGluZEJveFNjb3JlKyIgKCIrKGJsaW5kUmVzPy5kYXRhPy5wcml6ZXNOYW1lfHwi56ev5YiGIikrIikiKX19ZWxzZXtyZXN1bHQuc3RlcHMucHVzaCgi55uy55uS5pyq6Kej6ZSBKCIrc2lnbkNvdW50KyIvMzApIil9fWNhdGNoKGUpe3Jlc3VsdC5zdGVwcy5wdXNoKCLnm7Lnm5LlvILluLg6ICIrZSl9CmNvbnN0IGNvbW09Y2ZnLmNvbW11bml0eXx8e307bGV0IHBvc3RJZD1udWxsOwppZihjb21tLmVuYWJsZVBvc3QhPT1mYWxzZSl7dHJ5e2NvbnN0IHBvc3RSZXM9YXdhaXQgaHR0cFBvc3QoImh0dHBzOi8vdGFwaS56ZWVob2V2LmNvbS92MS4wL3NvY2lhbC9jZm1vdG9zZXJ2ZXJzb2NpYWwvY29tbW9uQXJ0aWNsZSIsey4uLmJhc2VIZWFkZXJzLC4uLmdldFNpZ24oImFwcCIse30sJycsY2ZnKX0se3Bvc3Rjb250ZW50OiLlvIDlv4PnmoTkuIDlpKkifSk7aWYocG9zdFJlcz8uY29kZT09IjEwMDAwIil7cG9zdElkPWdldFBvc3RJZEZyb21EYXRhKHBvc3RSZXMuZGF0YSk7cmVzdWx0LmludGVyYWN0U2NvcmUrPTE7cmVzdWx0LnN0ZXBzLnB1c2goIuWPkeW4luaIkOWKnyArMSIpfX1jYXRjaChlKXtyZXN1bHQuc3RlcHMucHVzaCgi5Y+R5biW5byC5bi4OiAiK2UpfX0KaWYoIXBvc3RJZCl7dHJ5e2NvbnN0IGxpc3RSZXM9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvc29jaWFsL2NmbW90b3NlcnZlcnNvY2lhbC9jb21tdW5pdHkvbWluZUFydGljbGVJbmZvP3VzZXJJZD0iK3VzZXJJZCsiJnBhZ2U9MSZwYWdlU2l6ZT0xMCIsey4uLmJhc2VIZWFkZXJzLC4uLmdldFNpZ24oImFwcCIse30sJycsY2ZnKX0pO2NvbnN0IHJhd0xpc3Q9QXJyYXkuaXNBcnJheShsaXN0UmVzPy5kYXRhKT9saXN0UmVzLmRhdGE6KGxpc3RSZXM/LmRhdGE/LnJlY29yZHN8fGxpc3RSZXM/LmRhdGE/Lmxpc3R8fFtdKTtjb25zdCBsaXN0PUFycmF5LmlzQXJyYXkocmF3TGlzdCk/cmF3TGlzdDpbXTtjb25zdCBtaW5lPWxpc3QuZmluZChpdD0+U3RyaW5nKGl0LnVzZXJJZHx8aXQuY3JlYXRlQnl8fGl0LnVpZHx8IiIpPT09U3RyaW5nKHVzZXJJZCkpO3Bvc3RJZD1nZXRQb3N0SWRGcm9tRGF0YShtaW5lfHxsaXN0WzBdfHxsaXN0UmVzPy5kYXRhKX1jYXRjaChlKXt9fQppZihwb3N0SWQpe2lmKGNvbW0uZW5hYmxlTGlrZSE9PWZhbHNlKXt0cnl7Y29uc3QgbGlrZVJlcz1hd2FpdCBodHRwUG9zdCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvc29jaWFsL2NmbW90b3NlcnZlcnNvY2lhbC9zb2NpYWxDb21tdS9saWtlRmF2b3JpdGVJbmZvIix7Li4uYmFzZUhlYWRlcnMsLi4uZ2V0U2lnbigiYXBwIix7fSwnJyxjZmcpfSx7cG9zdElkOlN0cmluZyhwb3N0SWQpLGtpbmRGbGFnOiIwIn0pO2lmKGxpa2VSZXM/LmNvZGU9PSIxMDAwMCIpe3Jlc3VsdC5pbnRlcmFjdFNjb3JlKz0xO3Jlc3VsdC5zdGVwcy5wdXNoKCLngrnotZ7miJDlip8gKzEiKX19Y2F0Y2goZSl7cmVzdWx0LnN0ZXBzLnB1c2goIueCuei1nuW8guW4uDogIitlKX19aWYoY29tbS5lbmFibGVDb21tZW50IT09ZmFsc2Upe3RyeXthd2FpdCBodHRwUG9zdCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvc29jaWFsL2NmbW90b3NlcnZlcnNvY2lhbC9jb21tZW50SW5mbyIsey4uLmJhc2VIZWFkZXJzLC4uLmdldFNpZ24oImFwcCIse30sJycsY2ZnKX0se3Bvc3RpZDpTdHJpbmcocG9zdElkKSx1c2VySWQ6U3RyaW5nKHVzZXJJZCksY29tbWVudHM6IuWOieWusyIsc2VuZFRvczoiW1xuXG5dIn0pO3Jlc3VsdC5zdGVwcy5wdXNoKCLor4TorrrlrozmiJAiKX1jYXRjaChlKXtyZXN1bHQuc3RlcHMucHVzaCgi6K+E6K665byC5bi4OiAiK2UpfX1pZihjb21tLmVuYWJsZVNoYXJlIT09ZmFsc2Upe3RyeXtjb25zdCBzaGFyZVJlcz1hd2FpdCBodHRwUHV0KCJodHRwczovL3RhcGkuemVlaG9ldi5jb20vdjEuMC9zb2NpYWwvY2Ztb3Rvc2VydmVyc29jaWFsL2FydGljbGUvc2hhcmUvIitwb3N0SWQsey4uLmJhc2VIZWFkZXJzLC4uLmdldFNpZ24oImFwcCIse30sJycsY2ZnKX0pO2lmKHNoYXJlUmVzPy5jb2RlPT0iMTAwMDAiKXtyZXN1bHQuaW50ZXJhY3RTY29yZSs9MTtyZXN1bHQuc3RlcHMucHVzaCgi5YiG5Lqr5oiQ5YqfICsxIil9YXdhaXQgaHR0cEdldCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvbWluZS9jZm1vdG9zZXJ2ZXJtaW5lL2ludGVncmFsL2FkanVzdEJ5U2hhcmUiLHsuLi5iYXNlSGVhZGVycywuLi5nZXRTaWduKCJhcHAiLHt9LCcnLGNmZyl9KX1jYXRjaChlKXtyZXN1bHQuc3RlcHMucHVzaCgi5YiG5Lqr5byC5bi4OiAiK2UpfX1pZihjb21tLmVuYWJsZURlbGV0ZSE9PWZhbHNlJiZwb3N0SWQpe3RyeXthd2FpdCBodHRwRGVsZXRlKCJodHRwczovL3RhcGkuemVlaG9ldi5jb20vdjEuMC9zb2NpYWwvY2Ztb3Rvc2VydmVyc29jaWFsL2NvbW1vbkFydGljbGUvZGVsZXRlQXJ0aWNsZT9hcnRpY2xlSWQ9Iitwb3N0SWQrIiZwb3N0VHlwZT0xIix7Li4uYmFzZUhlYWRlcnMsLi4uZ2V0U2lnbigiYXBwIix7fSwnJyxjZmcpfSk7cmVzdWx0LnN0ZXBzLnB1c2goIuWKqOaAgeW3suWIoOmZpCIpfWNhdGNoKGUpe3Jlc3VsdC5zdGVwcy5wdXNoKCLliKDpmaTlvILluLg6ICIrZSl9fX0KcmVzdWx0LnRvdGFsR2Fpbj1yZXN1bHQuc2lnbmluU2NvcmUrcmVzdWx0LmJsaW5kQm94U2NvcmUrcmVzdWx0LmludGVyYWN0U2NvcmU7cmVzdWx0LnN1Y2Nlc3M9dHJ1ZX1jYXRjaChlKXtyZXN1bHQuZXJyb3I9U3RyaW5nKGUpO3Jlc3VsdC5zdGVwcy5wdXNoKCLmiafooYzlvILluLg6ICIrZSl9cmV0dXJuIHJlc3VsdH0KCi8qID09PT09PT09PT09PT09PT09IOi9pui+huaOp+WItiA9PT09PT09PT09PT09PT09PSAqLwpjb25zdCBWRUhJQ0xFX0FDVElPTl9URVhUPXtmaW5kOiLnn63mjInlr7vovaYiLGxvdWRGaW5kOiLpuKPnrJvpl6rnga8iLGN1c2hpb246IuaJk+W8gOWdkOWeqyIsdW5sb2NrOiLkupHnq6/lvIDplIEiLGxvY2s6IuS6keerr+WFs+mUgSJ9OwpmdW5jdGlvbiB2ZWhpY2xlQ2hlY2tSZXMocmVzLG9rTXNnKXtpZihyZXMmJiFyZXMuZXJyb3ImJihyZXMuY29kZT09IjEwMDAwInx8cmVzLmNvZGU9PT0xMDAwMCkpcmV0dXJue29rOnRydWUsbWVzc2FnZTpva01zZ307Y29uc3QgZXJyVGV4dD1TdHJpbmcoKHJlcyYmKHJlcy5lcnJvcnx8cmVzLm1lc3NhZ2V8fHJlcy5tc2cpKXx8IiIpLnRvTG93ZXJDYXNlKCk7aWYocmVzJiZyZXMuZXJyb3ImJi90aW1lb3V0fHRpbWVkIG91dHx0aW1lIG91dHzor7fmsYLotoXml7YvLnRlc3QoZXJyVGV4dCkpcmV0dXJue29rOnRydWUsbWVzc2FnZTpva01zZysi77yI5ZON5bqU6LaF5pe25L2G6L2m6L6G6YCa5bi45bey5omn6KGM77yM5Y+v5LiL5ouJ5Yi35paw56Gu6K6k77yJIn07cmV0dXJue29rOmZhbHNlLG1lc3NhZ2U6KHJlcyYmKHJlcy5tZXNzYWdlfHxyZXMubXNnKSl8fChyZXMmJnJlcy5lcnJvcil8fCLmjIfku6TkuIvlj5HlpLHotKUiLGNvZGU6cmVzJiZyZXMuY29kZX19CmFzeW5jIGZ1bmN0aW9uIHZlaGljbGVDb250cm9sKGFjYyxhY3Rpb24sY2ZnKXt0cnl7Y29uc3QgYz1jZmd8fGdldENmZygpO2xldCB2aW49YWNjLnZpbk5vfHwiIjtpZighdmluKXtjb25zdCBsaXN0PWF3YWl0IGZldGNoVmVoaWNsZUxpc3QoYWNjLGMpO2lmKCFsaXN0fHwhbGlzdC5sZW5ndGgpcmV0dXJue29rOmZhbHNlLG1lc3NhZ2U6IuacquiOt+WPluWIsOe7keWumui9pui+hihWSU4p77yM6K+356Gu6K6k6LSm5Y+35bey57uR5a6a6L2m6L6GIn07dmluPWxpc3RbMF0udmluTm99Y29uc3QgYmFzZT1iYXNlSGVhZGVycyhhY2MpO2lmKGFjdGlvbj09PSJmaW5kIil7Y29uc3QgaD17Li4uYmFzZSwuLi5nZXRTaWduKCJhcHAiLHt9LCIiLGMpfTtjb25zdCByZXM9YXdhaXQgaHR0cFB1dCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvYXBwL2NmbW90b3NlcnZlcmFwcC92ZWhpY2xlSW5mby9jb250cm9sLyIrdmluLGgpO3JldHVybiB2ZWhpY2xlQ2hlY2tSZXMocmVzLCLlr7vovabmjIfku6Tlt7LkuIvlj5HvvIzovabovoblupTpl6rnga/mj5DnpLoiKX1pZihhY3Rpb249PT0ibG91ZEZpbmQiKXtjb25zdCBib2R5U3RyPUpTT04uc3RyaW5naWZ5KHtwYXJhbToiNCIsdmluOnZpbn0pO2NvbnN0IGg9ey4uLmJhc2UsLi4uZ2V0U2lnbigiYXBwIix7fSxib2R5U3RyLGMpfTtjb25zdCByZXM9YXdhaXQgaHR0cFBvc3QoImh0dHBzOi8vdGFwaS56ZWVob2V2LmNvbS92MS4wL2FwcC9jZm1vdG9zZXJ2ZXJhcHAvdmVoaWNsZUluZm8vY29udHJvbFYyIixoLGJvZHlTdHIpO3JldHVybiB2ZWhpY2xlQ2hlY2tSZXMocmVzLCLpuKPnrJvpl6rnga/mjIfku6Tlt7LkuIvlj5EiKX1pZihhY3Rpb249PT0iY3VzaGlvbiIpe2NvbnN0IGJvZHlTdHI9SlNPTi5zdHJpbmdpZnkoe2NvbW1vbmQ6IjI4Iixjb21tb25kUGFyYW06IjEiLHZjdTp2aW4sdmVyc2lvbjoidjIifSk7Y29uc3QgaD17Li4uYmFzZSwuLi5nZXRTaWduKCJhcHAiLHt9LGJvZHlTdHIsYyl9O2NvbnN0IHJlcz1hd2FpdCBodHRwUHV0KCJodHRwczovL3RhcGkuemVlaG9ldi5jb20vdjEuMC9hcHAvY2Ztb3Rvc2VydmVyYXBwL3ZlaGljbGVTZXQvcHJvcGVydHlUd28vb25lIixoLGJvZHlTdHIpO3JldHVybiB2ZWhpY2xlQ2hlY2tSZXMocmVzLCLlvIDlnZDlnqvmjIfku6Tlt7LkuIvlj5HvvIzlnZDlnqvlupTlvLnotbciKX1pZihhY3Rpb249PT0idW5sb2NrInx8YWN0aW9uPT09ImxvY2siKXtjb25zdCB2S2V5PShjLnZlaGljbGVBZXNLZXl8fCIiKS50cmltKCk7aWYoIXZLZXkpcmV0dXJue29rOmZhbHNlLG1lc3NhZ2U6IuWwmuacqumFjee9ruS6keerr+aOp+i9puWvhumSpe+8muivt+WIsOOAjOiuvue9ri3nrb7lkI3lr4bpkqXphY3nva7jgI3loavlhpnkupHnq6/mjqfovaZBRVPlr4bpkqXlubbkv53lrZjlkI7lho3kvb/nlKjlvIAv5YWz6ZSBIn07aWYoIS9eWzAtOWEtZkEtRl17MzJ9JC8udGVzdCh2S2V5KSlyZXR1cm57b2s6ZmFsc2UsbWVzc2FnZToi5LqR56uv5o6n6L2m5a+G6ZKl5qC85byP6ZSZ6K+v77yI5bqU5Li6MzLkvY3ljYHlha3ov5vliLbvvInvvIzor7fliLDorr7nva7pobXmoLjlr7nlkI7kv53lrZgifTtjb25zdCBsb2NrRmxhZz1hY3Rpb249PT0idW5sb2NrIj8iMSI6IjAiO2NvbnN0IHBsYWluPSd7XG4gICJsb2NrRmxhZyIgOiAiJytsb2NrRmxhZysnIixcbiAgInZpbk5vIiA6ICInK3ZpbisnIlxufSc7Y29uc3Qgc2VjcmV0PWFlczI1NkVjYkVuY3J5cHRCYXNlNjQocGxhaW4sdktleSk7Y29uc3Qgc2VuZEJvZHk9SlNPTi5zdHJpbmdpZnkoe3NlY3JldDpzZWNyZXR9KTtjb25zdCBoPXsuLi5iYXNlLC4uLmdldFNpZ24oImFwcCIse30scGxhaW4sYyl9O2NvbnN0IHJlcz1hd2FpdCBodHRwUG9zdCgiaHR0cHM6Ly90YXBpLnplZWhvZXYuY29tL3YxLjAvYXBwL2NmbW90b3NlcnZlcmFwcC92ZWhpY2xlU2V0L25ldHdvcmsvdW5sb2NrIixoLHNlbmRCb2R5LDI1MDAwKTtyZXR1cm4gdmVoaWNsZUNoZWNrUmVzKHJlcyxhY3Rpb249PT0idW5sb2NrIj8i5LqR56uv5byA6ZSB5oyH5Luk5bey5LiL5Y+RIjoi5LqR56uv5YWz6ZSB5oyH5Luk5bey5LiL5Y+RIil9cmV0dXJue29rOmZhbHNlLG1lc3NhZ2U6IuacquefpeaTjeS9nOexu+WeizogIithY3Rpb259fWNhdGNoKGUpe3JldHVybntvazpmYWxzZSxtZXNzYWdlOiLmjqfliLblvILluLg6ICIrU3RyaW5nKGUpfX19Cgphc3luYyBmdW5jdGlvbiBiYXJrUHVzaChiYXJrS2V5LHRpdGxlLGJvZHkpe3RyeXtsZXQgcz1TdHJpbmcoYmFya0tleXx8IiIpLnRyaW0oKS5yZXBsYWNlKC9cLyskLywiIik7cz1zLnJlcGxhY2UoL15odHRwcz86XC9cL2FwaVwuZGF5XC5hcHBcLy9pLCIiKTtpZighcylyZXR1cm57c2tpcHBlZDp0cnVlfTtsZXQgYmFzZT0iaHR0cHM6Ly9hcGkuZGF5LmFwcCIsa2V5PXM7Y29uc3QgbT1zLm1hdGNoKC9eKGh0dHBzPzpcL1wvW14vXSspXC8oLispJC9pKTtpZihtKXtiYXNlPW1bMV07a2V5PW1bMl19a2V5PWtleS5yZXBsYWNlKC9eXC8rLywiIik7Y29uc3QgdT1iYXNlKyIvIitlbmNvZGVVUklDb21wb25lbnQoa2V5KSsiLyIrZW5jb2RlVVJJQ29tcG9uZW50KHRpdGxlKSsiLyIrZW5jb2RlVVJJQ29tcG9uZW50KGJvZHkpKyI/Z3JvdXA9WkVFSE8mc291bmQ9YmlyZHNvbmciO3JldHVybiBhd2FpdCBodHRwR2V0KHUse30pfWNhdGNoKGUpe3JldHVybntlcnJvcjpTdHJpbmcoZSl9fX0KCi8qID09PT09PT09PT09PT09PT09IOS7o+eQhuaooeW8j++8iOaMh+WQkeWOn+iEmuacrCB6ZWVoby5ib3gg5ZCO56uv77yJID09PT09PT09PT09PT09PT09ICovCmFzeW5jIGZ1bmN0aW9uIHByb3h5RmV0Y2gocGF0aCxvcHRzKXtjb25zdCByYXdCYXNlPWdldENmZygpLnNlcnZlckJhc2UucmVwbGFjZSgvXC8rJC8sIiIpO2NvbnN0IGJhc2U9KHdpbmRvdy5fX1BBTkVMX01PREVfXyYmIXJhd0Jhc2UpPyIiOnJhd0Jhc2U7Y29uc3Qgcj1hd2FpdCBmZXRjaChiYXNlK3BhdGgsb3B0c3x8e30pO2NvbnN0IHQ9YXdhaXQgci50ZXh0KCk7dHJ5e3JldHVybiBKU09OLnBhcnNlKHQpfWNhdGNoKGUpe3JldHVybntlcnJvcjoicGFyc2UgZXJyb3IiLHJhdzp0fX19CmZ1bmN0aW9uIHByb3h5UG9zdChwYXRoLGJvZHkpe3JldHVybiBwcm94eUZldGNoKHBhdGgse21ldGhvZDoiUE9TVCIsaGVhZGVyczp7IkNvbnRlbnQtVHlwZSI6ImFwcGxpY2F0aW9uL2pzb24ifSxib2R5OkpTT04uc3RyaW5naWZ5KGJvZHl8fHt9KX0pfQoKYXN5bmMgZnVuY3Rpb24gZmV0Y2hBbGxBY2NvdW50cyhhY2NvdW50cyxjZmcsbGltaXQpe2NvbnN0IG91dD1uZXcgQXJyYXkoYWNjb3VudHMubGVuZ3RoKTtsZXQgaT0wO2FzeW5jIGZ1bmN0aW9uIHdvcmtlcigpe3doaWxlKGk8YWNjb3VudHMubGVuZ3RoKXtjb25zdCBpZHg9aSsrO3RyeXtvdXRbaWR4XT1hd2FpdCBmZXRjaEFjY291bnREYXRhKGFjY291bnRzW2lkeF0sY2ZnKX1jYXRjaChlKXtvdXRbaWR4XT17dXNlck5hbWU6YWNjb3VudHNbaWR4XS51c2VyTmFtZXx8IuacquefpSIsdXNlcklkOmFjY291bnRzW2lkeF0udXNlcklkLHN1Y2Nlc3M6ZmFsc2UsZXJyb3I6U3RyaW5nKGUpfX19fWNvbnN0IG49TWF0aC5tYXgoMSxNYXRoLm1pbihsaW1pdHx8MyxhY2NvdW50cy5sZW5ndGgpKTthd2FpdCBQcm9taXNlLmFsbChBcnJheS5mcm9tKHtsZW5ndGg6bn0sd29ya2VyKSk7cmV0dXJuIG91dH0KCmNvbnN0IEJhY2tlbmQ9ewogIGFzeW5jIHNlbmRDb2RlKHBob25lKXsKICAgIGlmKGlzUHJveHlNb2RlKCkpe2NvbnN0IGQ9YXdhaXQgcHJveHlQb3N0KCIvYXBpL3NlbmQtY29kZSIse3Bob25lOnBob25lfSk7cmV0dXJue29rOiEhZC5vayxtZXNzYWdlOmQubWVzc2FnZXx8KGQub2s/IumqjOivgeeggeW3suWPkemAgSI6IuWPkemAgeWksei0pSIpfTt9CiAgICBjb25zdCBjZmc9Z2V0Q2ZnKCk7Y29uc3Qgc2lnbkg9Z2V0U2lnbigiaDUiLHt9LCIiLGNmZyk7CiAgICBjb25zdCBkPWF3YWl0IGh0dHBHZXQoImh0dHBzOi8vaDUuemVlaG9ldi5jb20vY2Ztb3Rvc2VydmVybWluZS9hdXRoQ29kZS8iK2VuY29kZVVSSUNvbXBvbmVudChwaG9uZSkseyJDb250ZW50LVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9VVRGLTgiLC4uLnNpZ25IfSk7CiAgICByZXR1cm57b2s6U3RyaW5nKGQuY29kZSk9PT0iMTAwMDAiLG1lc3NhZ2U6U3RyaW5nKGQuY29kZSk9PT0iMTAwMDAiPyLpqozor4HnoIHlt7Llj5HpgIHvvIzor7fmn6XmlLbnn63kv6EiOigoZCYmKGQubWVzc2FnZXx8ZC5tc2cpKXx8IuWPkemAgeWksei0pSIpfTsKICB9LAogIGFzeW5jIHBob25lTG9naW4ocGhvbmUsY29kZSl7CiAgICBpZihpc1Byb3h5TW9kZSgpKXtjb25zdCBkPWF3YWl0IHByb3h5UG9zdCgiL2FwaS9waG9uZS1sb2dpbiIse3Bob25lOnBob25lLGNvZGU6Y29kZX0pO3JldHVybntvazohIWQub2ssbWVzc2FnZTpkLm1lc3NhZ2V8fChkLm9rPyLnmbvlvZXmiJDlip8iOiLnmbvlvZXlpLHotKUiKX07fQogICAgY29uc3QgY2ZnPWdldENmZygpO2NvbnN0IHBheWxvYWQ9e3Bob25lOnBob25lLGF1dGhDb2RlOmNvZGV9OwogICAgY29uc3QgcmVzPWF3YWl0IGh0dHBQb3N0KCJodHRwczovL2g1LnplZWhvZXYuY29tL2NmbW90b3NlcnZlcm1pbmUvdXNlci9sb2dpbkJ5UGhvbmUiLHsiQ29udGVudC1UeXBlIjoiYXBwbGljYXRpb24vanNvbjtjaGFyc2V0PVVURi04IiwuLi5oNVNpZ25XaXRoQm9keShwYXlsb2FkLGNmZyl9LHBheWxvYWQsMjAwMDApOwogICAgY29uc3QgdG9rZW5JbmZvPXJlcyYmcmVzLmRhdGEmJnJlcy5kYXRhLnRva2VuSW5mbztjb25zdCBhY2Nlc3NUb2tlbj10b2tlbkluZm8mJlN0cmluZyh0b2tlbkluZm8uYWNjZXNzX3Rva2VufHwiIik7CiAgICBpZighcmVzfHxTdHJpbmcocmVzLmNvZGUpIT09IjEwMDAwInx8IWFjY2Vzc1Rva2VuKXJldHVybntvazpmYWxzZSxtZXNzYWdlOiLnmbvlvZXlpLHotKXvvJoiKygocmVzJiYocmVzLm1lc3NhZ2V8fHJlcy5tc2cpKXx8IumqjOivgeeggeacieivr+aIluW3sui/h+acnyIpfTsKICAgIGxldCB1c2VySWQ9IiIsdXNlck5hbWU9IiI7CiAgICB0cnl7Y29uc3Qgc2lnbkgwPWdldFNpZ24oImg1Iix7c2VydmVyX25hbWU6IlNNQVJUIn0sIiIsY2ZnKTtjb25zdCBpbmZvUmVzPWF3YWl0IGh0dHBHZXQoImh0dHBzOi8vaDUuemVlaG9ldi5jb20vY2Ztb3Rvc2VydmVybWluZS9iYXNlSW5mbz9zZXJ2ZXJfbmFtZT1TTUFSVCIseyJBdXRob3JpemF0aW9uIjoiQmVhcmVyICIrYWNjZXNzVG9rZW4sIkNvbnRlbnQtVHlwZSI6ImFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD1VVEYtOCIsImludGVyZmFjZXZlcnNpb24iOiIyIiwuLi5zaWduSDB9KTtpZihpbmZvUmVzJiZTdHJpbmcoaW5mb1Jlcy5jb2RlKT09PSIxMDAwMCImJmluZm9SZXMuZGF0YSl7dXNlcklkPVN0cmluZyhpbmZvUmVzLmRhdGEuaWR8fCIiKTt1c2VyTmFtZT1TdHJpbmcoaW5mb1Jlcy5kYXRhLm5pY2tOYW1lfHwiIik7fX1jYXRjaChlKXt9CiAgICBjb25zdCBsaXN0PWdldEFjY291bnRzKCk7bGV0IHJlcGxhY2VkPWZhbHNlOwogICAgZm9yKGxldCBpPTA7aTxsaXN0Lmxlbmd0aDtpKyspe2lmKGxpc3RbaV0mJihTdHJpbmcobGlzdFtpXS50b2tlbnx8IiIpPT09YWNjZXNzVG9rZW58fChsaXN0W2ldLnVzZXJJZCYmdXNlcklkJiZTdHJpbmcobGlzdFtpXS51c2VySWQpPT09dXNlcklkKSkpe2xpc3RbaV0udG9rZW49YWNjZXNzVG9rZW47aWYodXNlcklkKWxpc3RbaV0udXNlcklkPXVzZXJJZDtpZih1c2VyTmFtZSlsaXN0W2ldLnVzZXJOYW1lPXVzZXJOYW1lO3JlcGxhY2VkPXRydWU7YnJlYWs7fX0KICAgIGNvbnN0IG5ld0FjYz17dXNlck5hbWU6dXNlck5hbWV8fHBob25lLHVzZXJJZDp1c2VySWQsdG9rZW46YWNjZXNzVG9rZW4sYmFya0tleToiIix1c2VyQWdlbnQ6IiJ9OwogICAgaWYoIXJlcGxhY2VkKWxpc3QucHVzaChuZXdBY2MpOwogICAgc2F2ZUFjY291bnRzKGxpc3QpOwogICAgcmV0dXJue29rOnRydWUsbWVzc2FnZTpyZXBsYWNlZD8i55m75b2V5oiQ5Yqf77yM5bey5pu05paw6K+l6LSm5Y+3Ijoi55m75b2V5oiQ5Yqf77yM5bey5re75Yqg6LSm5Y+3In07CiAgfSwKICBhc3luYyBnZXREYXNoYm9hcmQoKXsKICAgIGlmKGlzUHJveHlNb2RlKCkpewogICAgICBjb25zdCBkPWF3YWl0IHByb3h5RmV0Y2goIi9hcGkvZGF0YSIpOwogICAgICBpZihkJiZkLmFjY291bnRzKXJldHVybnthY2NvdW50czpkLmFjY291bnRzLHRpbWVzdGFtcDpkLnRpbWVzdGFtcHx8bmV3IERhdGUoKS50b0lTT1N0cmluZygpLGNvbmZpZzpkLmNvbmZpZ3x8bnVsbCxvazp0cnVlfTsKICAgICAgcmV0dXJue29rOmZhbHNlLGVycm9yOihkJiZkLmVycm9yKXx8IuS7o+eQhuacjeWKoeaXoOWTjeW6lCIscmF3OmR9OwogICAgfQogICAgY29uc3QgY2ZnPWdldENmZygpO2NvbnN0IGFjY291bnRzPWdldEFjY291bnRzKCk7Y29uc3QgZGF0YT1hd2FpdCBmZXRjaEFsbEFjY291bnRzKGFjY291bnRzLGNmZywzKTsKICAgIHJldHVybnthY2NvdW50czpkYXRhLHRpbWVzdGFtcDpuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksb2s6dHJ1ZX07CiAgfSwKICBhc3luYyBydW5TaWduaW4odXNlcklkLGFsbCl7CiAgICBpZihpc1Byb3h5TW9kZSgpKXtjb25zdCBkPWF3YWl0IHByb3h5UG9zdCgiL2FwaS9ydW4tc2lnbmluIixhbGw/e2FsbDp0cnVlfTp7dXNlcklkOnVzZXJJZH0pO2lmKGQmJmQucmVzdWx0cylyZXR1cm57b2s6dHJ1ZSxyZXN1bHRzOmQucmVzdWx0c307cmV0dXJue29rOmZhbHNlLGVycm9yOihkJiZkLmVycm9yKXx8IuaJp+ihjOWksei0pSJ9fQogICAgY29uc3QgY2ZnPWdldENmZygpO2NvbnN0IGFjY291bnRzPWdldEFjY291bnRzKCk7Y29uc3QgcmVzdWx0cz1bXTtjb25zdCB0YXJnZXRzPWFsbD9hY2NvdW50czphY2NvdW50cy5maWx0ZXIoYT0+U3RyaW5nKGEudXNlcklkKT09PVN0cmluZyh1c2VySWQpKTsKICAgIGlmKCF0YXJnZXRzLmxlbmd0aClyZXR1cm57b2s6dHJ1ZSxyZXN1bHRzOltdfTsKICAgIGZvcihjb25zdCBhY2Mgb2YgdGFyZ2V0cyl7Y29uc3Qgcj1hd2FpdCBydW5TaWduaW5Gb3JBY2NvdW50KGFjYyxjZmcpO3Jlc3VsdHMucHVzaChyKTtjb25zdCBfZD1uZXcgRGF0ZSgpO2NvbnN0IF9kcz1fZC5nZXRGdWxsWWVhcigpKyItIitTdHJpbmcoX2QuZ2V0TW9udGgoKSsxKS5wYWRTdGFydCgyLCIwIikrIi0iK1N0cmluZyhfZC5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIjAiKTthZGRMb2coe3RpbWU6X2QudG9Mb2NhbGVTdHJpbmcoInpoLUNOIix7aG91cjEyOmZhbHNlfSksZGF0ZTpfZHMsdHlwZToic2lnbmluIix1c2VyTmFtZTpyLnVzZXJOYW1lLHVzZXJJZDpyLnVzZXJJZCxzdWNjZXNzOnIuc3VjY2Vzcyx0b3RhbEdhaW46ci50b3RhbEdhaW4sc2lnbmluU2NvcmU6ci5zaWduaW5TY29yZSxibGluZEJveFNjb3JlOnIuYmxpbmRCb3hTY29yZSxpbnRlcmFjdFNjb3JlOnIuaW50ZXJhY3RTY29yZSxjb250aW51ZURheXM6ci5jb250aW51ZURheXMsZXJyb3I6ci5lcnJvcixzdGVwczpyLnN0ZXBzfSk7aWYoci5zdWNjZXNzJiZhY2MuYmFya0tleSYmU3RyaW5nKGFjYy5iYXJrS2V5KS50cmltKCkpe3RyeXthd2FpdCBiYXJrUHVzaChhY2MuYmFya0tleSwi5p6B5qC4562+5Yiw5oiQ5YqfIMK3ICIrKHIudXNlck5hbWV8fCIiKSwi5LuK5pel6I635b6XICIrci50b3RhbEdhaW4rIiDliIbvvIjnrb7liLAiK3Iuc2lnbmluU2NvcmUrIiAvIOebsuebkiIrci5ibGluZEJveFNjb3JlKyIgLyDkupLliqgiK3IuaW50ZXJhY3RTY29yZSsi77yJ77yM6L+e562+ICIrci5jb250aW51ZURheXMrIiDlpKkiKX1jYXRjaChlKXt9fX0KICAgIHJldHVybntvazp0cnVlLHJlc3VsdHN9OwogIH0sCiAgYXN5bmMgdmVoaWNsZUN0cmwodXNlcklkLGFjdGlvbil7CiAgICBpZihpc1Byb3h5TW9kZSgpKXtjb25zdCBkPWF3YWl0IHByb3h5UG9zdCgiL2FwaS92ZWhpY2xlLWNvbnRyb2wiLHt1c2VySWQ6dXNlcklkLGFjdGlvbjphY3Rpb259KTtyZXR1cm57b2s6ISFkLm9rLG1lc3NhZ2U6ZC5tZXNzYWdlfHwoZC5vaz8i5oyH5Luk5bey5LiL5Y+RIjoi5oyH5Luk5aSx6LSlIil9fQogICAgY29uc3QgY2ZnPWdldENmZygpO2NvbnN0IGFjY291bnRzPWdldEFjY291bnRzKCk7bGV0IGFjYz1hY2NvdW50cy5maW5kKGE9PlN0cmluZyhhLnVzZXJJZCk9PT1TdHJpbmcodXNlcklkKSk7aWYoIWFjYyYmYWNjb3VudHMubGVuZ3RoKWFjYz1hY2NvdW50c1swXTtpZighYWNjKXJldHVybntvazpmYWxzZSxtZXNzYWdlOiLmnKrmib7liLDotKblj7fvvIzor7flhYjlnKjorr7nva7pobXmt7vliqAifTtpZighVkVISUNMRV9BQ1RJT05fVEVYVFthY3Rpb25dKXJldHVybntvazpmYWxzZSxtZXNzYWdlOiLpnZ7ms5Xmk43kvZznsbvlnosifTtjb25zdCByPWF3YWl0IHZlaGljbGVDb250cm9sKGFjYyxhY3Rpb24sY2ZnKTtjb25zdCBfdmQ9bmV3IERhdGUoKTtjb25zdCBfdmRzPV92ZC5nZXRGdWxsWWVhcigpKyItIitTdHJpbmcoX3ZkLmdldE1vbnRoKCkrMSkucGFkU3RhcnQoMiwiMCIpKyItIitTdHJpbmcoX3ZkLmdldERhdGUoKSkucGFkU3RhcnQoMiwiMCIpO2FkZExvZyh7dGltZTpfdmQudG9Mb2NhbGVTdHJpbmcoInpoLUNOIix7aG91cjEyOmZhbHNlfSksZGF0ZTpfdmRzLHR5cGU6InZlaGljbGUiLGFjdGlvbjphY3Rpb24sYWN0aW9uVGV4dDpWRUhJQ0xFX0FDVElPTl9URVhUW2FjdGlvbl18fCLovabovobmjqfliLYiLHVzZXJOYW1lOmFjYy51c2VyTmFtZXx8IuacquefpSIsdXNlcklkOmFjYy51c2VySWQsc3VjY2VzczohIXIub2ssbWVzc2FnZTpyLm1lc3NhZ2V8fCIiLGVycm9yOnIub2s/IiI6KHIubWVzc2FnZXx8IuaMh+S7pOWksei0pSIpfSk7cmV0dXJuIHI7CiAgfSwKICBhc3luYyBnZXRMb2dzKCl7aWYoaXNQcm94eU1vZGUoKSl7Y29uc3QgZD1hd2FpdCBwcm94eUZldGNoKCIvYXBpL2dldC1sb2dzIik7cmV0dXJuIGQmJmQubG9ncz9kLmxvZ3M6W119cmV0dXJuIGdldExvZ3MoKX0sCiAgYXN5bmMgY2xlYXJMb2dzKCl7aWYoaXNQcm94eU1vZGUoKSl7Y29uc3QgZD1hd2FpdCBwcm94eVBvc3QoIi9hcGkvY2xlYXItbG9ncyIpO3JldHVybiAhIWQub2t9cmV0dXJuIGNsZWFyTG9ncygpfSwKICBhc3luYyBzYXZlQ29uZmlnKGMpe2lmKGlzUHJveHlNb2RlKCkpe2NvbnN0IGQ9YXdhaXQgcHJveHlQb3N0KCIvYXBpL3NhdmUtY29uZmlnIixjKTtyZXR1cm4gISFkLm9rfXJldHVybiBzYXZlQ2ZnKGMpfSwKICBhc3luYyBzYXZlQWNjb3VudHMobGlzdCl7aWYoaXNQcm94eU1vZGUoKSl7Y29uc3QgZD1hd2FpdCBwcm94eVBvc3QoIi9hcGkvc2F2ZS1hY2NvdW50cyIse2FjY291bnRzOmxpc3R9KTtyZXR1cm4gISFkLm9rfXJldHVybiBzYXZlQWNjb3VudHMobGlzdCl9LAogIGFzeW5jIGdldFVzZXJpZCh0b2tlbil7aWYoaXNQcm94eU1vZGUoKSl7Y29uc3QgZD1hd2FpdCBwcm94eVBvc3QoIi9hcGkvZ2V0LXVzZXJpZCIse3Rva2VuOnRva2VufSk7cmV0dXJue29rOiEhZC5vayx1c2VySWQ6ZC51c2VySWR8fCIiLHVzZXJOYW1lOmQudXNlck5hbWV8fCIiLGVycm9yOmQuZXJyb3J8fCIifX1yZXR1cm4gZ2V0VXNlcmlkQnlUb2tlbih0b2tlbixnZXRDZmcoKSl9LAogIGFzeW5jIGdldENvbmZpZygpe2lmKGlzUHJveHlNb2RlKCkpe2NvbnN0IGQ9YXdhaXQgcHJveHlGZXRjaCgiL2FwaS9jb25maWciKTtpZihkJiZkLmNvbmZpZylyZXR1cm57b2s6dHJ1ZSxjb25maWc6ZC5jb25maWd9O3JldHVybntvazpmYWxzZSxlcnJvcjooZCYmZC5lcnJvcil8fCLojrflj5bphY3nva7lpLHotKUifX1yZXR1cm57b2s6dHJ1ZSxjb25maWc6Z2V0Q2ZnKCl9fSwKICBhc3luYyBnZXRBY2NvdW50c0Z1bGwoKXtpZihpc1Byb3h5TW9kZSgpKXtjb25zdCBkPWF3YWl0IHByb3h5RmV0Y2goIi9hcGkvYWNjb3VudHMiKTtyZXR1cm4gQXJyYXkuaXNBcnJheShkJiZkLmFjY291bnRzKT9kLmFjY291bnRzOltdfXJldHVybiBnZXRBY2NvdW50cygpfSwKICBhc3luYyBiYWNrdXAoKXsKICAgIGlmKGlzUHJveHlNb2RlKCkpe2NvbnN0IGQ9YXdhaXQgcHJveHlGZXRjaCgiL2FwaS9iYWNrdXAiKTtyZXR1cm4gZCYmZC5vaz9kOm51bGx9CiAgICByZXR1cm57b2s6dHJ1ZSxhcHA6IuaegeaguFpFRUhPIix0eXBlOiJ6ZWVob19iYWNrdXAiLHZlcnNpb246QVBQX1ZFUlNJT04sdGltZTpmbXRUaW1lKG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSksYWNjb3VudHM6Z2V0QWNjb3VudHMoKSxjb25maWc6Z2V0Q2ZnKCl9CiAgfSwKICBhc3luYyByZXN0b3JlQmFja3VwKGpzb24pewogICAgaWYoaXNQcm94eU1vZGUoKSl7Y29uc3QgZD1hd2FpdCBwcm94eVBvc3QoIi9hcGkvaW1wb3J0Iix7anNvbjpqc29ufSk7cmV0dXJuIGR8fHtvazpmYWxzZSxlcnJvcjoi5ZCO56uv5peg5ZON5bqUIn19CiAgICB0cnl7CiAgICAgIGNvbnN0IGI9dHlwZW9mIGpzb249PT0ic3RyaW5nIj9KU09OLnBhcnNlKGpzb24pOmpzb247CiAgICAgIGlmKCFifHwoYi50eXBlIT09InplZWhvX2JhY2t1cCImJiFBcnJheS5pc0FycmF5KGIuYWNjb3VudHMpKSlyZXR1cm57b2s6ZmFsc2UsZXJyb3I6IuWkh+S7veagvOW8j+S4jeato+ehriJ9OwogICAgICBjb25zdCBsaXN0PShiLmFjY291bnRzfHxbXSkubWFwKGE9Pih7dXNlck5hbWU6YS51c2VyTmFtZXx8IiIsdXNlcklkOmEudXNlcklkfHwiIix0b2tlbjpjbGVhblRva2VuKGEudG9rZW4pLGJhcmtLZXk6Y2xlYW5CYXJrS2V5KGEuYmFya0tleXx8IiIpLHVzZXJBZ2VudDphLnVzZXJBZ2VudHx8IiJ9KSk7CiAgICAgIHNhdmVBY2NvdW50cyhsaXN0KTsKICAgICAgaWYoYi5jb25maWcmJnR5cGVvZiBiLmNvbmZpZz09PSJvYmplY3QiKXsKICAgICAgICBjb25zdCBjdXI9Z2V0Q2ZnKCk7CiAgICAgICAgc2F2ZUNmZyh7CiAgICAgICAgICBhcHA6e2FwcElkOmIuY29uZmlnLmFwcD8uYXBwSWR8fGN1ci5hcHAuYXBwSWQsYXBwU2VjcmV0OmIuY29uZmlnLmFwcD8uYXBwU2VjcmV0fHxjdXIuYXBwLmFwcFNlY3JldH0sCiAgICAgICAgICBoNTp7YXBwSWQ6Yi5jb25maWcuaDU/LmFwcElkfHxjdXIuaDUuYXBwSWQsYXBwU2VjcmV0OmIuY29uZmlnLmg1Py5hcHBTZWNyZXR8fGN1ci5oNS5hcHBTZWNyZXR9LAogICAgICAgICAgY29tbXVuaXR5OntlbmFibGVQb3N0OmIuY29uZmlnLmNvbW11bml0eT8uZW5hYmxlUG9zdCE9PWZhbHNlLGVuYWJsZUxpa2U6Yi5jb25maWcuY29tbXVuaXR5Py5lbmFibGVMaWtlIT09ZmFsc2UsZW5hYmxlQ29tbWVudDpiLmNvbmZpZy5jb21tdW5pdHk/LmVuYWJsZUNvbW1lbnQhPT1mYWxzZSxlbmFibGVTaGFyZTpiLmNvbmZpZy5jb21tdW5pdHk/LmVuYWJsZVNoYXJlIT09ZmFsc2UsZW5hYmxlRGVsZXRlOmIuY29uZmlnLmNvbW11bml0eT8uZW5hYmxlRGVsZXRlIT09ZmFsc2V9LAogICAgICAgICAgdmVoaWNsZUFlc0tleTpTdHJpbmcoYi5jb25maWcudmVoaWNsZUFlc0tleXx8IiIpLnRyaW0oKSwKICAgICAgICAgIGF1dG9SZWZyZXNoU2VjOm5vcm1hbGl6ZVJlZnJlc2hTZWMoYi5jb25maWcuYXV0b1JlZnJlc2hTZWMpLAogICAgICAgICAgc2VydmVyQmFzZTpjdXIuc2VydmVyQmFzZQogICAgICAgIH0pOwogICAgICB9CiAgICAgIHJldHVybntvazp0cnVlLGNvdW50Omxpc3QubGVuZ3RofTsKICAgIH1jYXRjaChlKXtyZXR1cm57b2s6ZmFsc2UsZXJyb3I6U3RyaW5nKGUpfX0KICB9Cn07Ci8qID09PT09PT09PT09PT09PT09IOmdouadv+aVsOaNruWQjOatpe+8iOmdouadv+aooeW8j++8muiuvue9rumhteS7juiEmuacrOWQjuerr+ivu+i0puWPt+S4jumFjee9ru+8iSA9PT09PT09PT09PT09PT09PSAqLwpmdW5jdGlvbiBhcHBseVJlbW90ZUNmZyhjKXsKICBpZighY3x8dHlwZW9mIGMhPT0ib2JqZWN0IilyZXR1cm47CiAgY29uc3QgbG9jYWw9Z2V0Q2ZnKCk7CiAgc2F2ZUNmZyh7CiAgICBhcHA6e2FwcElkOmMuYXBwPy5hcHBJZHx8bG9jYWwuYXBwLmFwcElkLGFwcFNlY3JldDpjLmFwcD8uYXBwU2VjcmV0fHxsb2NhbC5hcHAuYXBwU2VjcmV0fSwKICAgIGg1OnthcHBJZDpjLmg1Py5hcHBJZHx8bG9jYWwuaDUuYXBwSWQsYXBwU2VjcmV0OmMuaDU/LmFwcFNlY3JldHx8bG9jYWwuaDUuYXBwU2VjcmV0fSwKICAgIGNvbW11bml0eTp7ZW5hYmxlUG9zdDpjLmNvbW11bml0eT8uZW5hYmxlUG9zdCE9PWZhbHNlLGVuYWJsZUxpa2U6Yy5jb21tdW5pdHk/LmVuYWJsZUxpa2UhPT1mYWxzZSxlbmFibGVDb21tZW50OmMuY29tbXVuaXR5Py5lbmFibGVDb21tZW50IT09ZmFsc2UsZW5hYmxlU2hhcmU6Yy5jb21tdW5pdHk/LmVuYWJsZVNoYXJlIT09ZmFsc2UsZW5hYmxlRGVsZXRlOmMuY29tbXVuaXR5Py5lbmFibGVEZWxldGUhPT1mYWxzZX0sCiAgICB2ZWhpY2xlQWVzS2V5OlN0cmluZyhjLnZlaGljbGVBZXNLZXl8fCIiKS50cmltKCksCiAgICBhdXRvUmVmcmVzaFNlYzpub3JtYWxpemVSZWZyZXNoU2VjKGMuYXV0b1JlZnJlc2hTZWMpLAogICAgc2VydmVyQmFzZTpsb2NhbC5zZXJ2ZXJCYXNlCiAgfSk7Cn0KbGV0IHBhbmVsU3luY2luZz1mYWxzZTsKYXN5bmMgZnVuY3Rpb24gZW5zdXJlUGFuZWxEYXRhKGZvcmNlKXsKICBpZighaXNQcm94eU1vZGUoKXx8bG9jYXRpb24uc2VhcmNoLmluZGV4T2YoImRlbW8iKT49MClyZXR1cm47CiAgaWYocGFuZWxTeW5jaW5nKXJldHVybjsKICBpZighZm9yY2UmJlNUQVRFLnBhbmVsTG9hZGVkKXJldHVybjsKICBwYW5lbFN5bmNpbmc9dHJ1ZTsKICB0cnl7CiAgICBjb25zdCBbYyxhXT1hd2FpdCBQcm9taXNlLmFsbChbQmFja2VuZC5nZXRDb25maWcoKSxCYWNrZW5kLmdldEFjY291bnRzRnVsbCgpXSk7CiAgICBpZihhJiZhLmxlbmd0aCl7U1RBVEUucGFuZWxBY2NvdW50cz1hfQogICAgaWYoYyYmYy5vayYmYy5jb25maWcpYXBwbHlSZW1vdGVDZmcoYy5jb25maWcpOwogICAgU1RBVEUucGFuZWxMb2FkZWQ9dHJ1ZTsKICB9Y2F0Y2goZSl7fQogIHBhbmVsU3luY2luZz1mYWxzZTsKfQovKiA9PT09PT09PT09PT09PT09PSDlm77moIcgPT09PT09PT09PT09PT09PT0gKi8KY29uc3QgST17CmNoZWNrOic8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi42IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMCA2IDkgMTdsLTUtNSIvPjwvc3ZnPicsCng6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+PHBhdGggZD0iTTE4IDYgNiAxOE02IDZsMTIgMTIiLz48L3N2Zz4nLAp6YXA6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEzIDIgMyAxNGg3bC0xIDggMTAtMTJoLTdsMS04eiIvPjwvc3ZnPicsCmxvY2s6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iNCIgeT0iMTEiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxMCIgcng9IjMiLz48cGF0aCBkPSJNOCAxMVY3YTQgNCAwIDAgMSA4IDB2NCIvPjwvc3ZnPicsCnVubG9jazonPHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSI0IiB5PSIxMSIgd2lkdGg9IjE2IiBoZWlnaHQ9IjEwIiByeD0iMyIvPjxwYXRoIGQ9Ik04IDExVjdhNCA0IDAgMCAxIDcuNS0xLjciLz48L3N2Zz4nLApiZWxsOic8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xOCA4YTYgNiAwIDEgMC0xMiAwYzAgNy0zIDktMyA5aDE4cy0zLTItMy05Ii8+PHBhdGggZD0iTTEzLjcgMjFhMiAyIDAgMCAxLTMuNCAwIi8+PC9zdmc+JywKdm9sOic8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xMSA1IDYgOUgydjZoNGw1IDRWNXoiLz48cGF0aCBkPSJNMTUuNSA4LjVhNSA1IDAgMCAxIDAgN00xOC41IDUuNWE5IDkgMCAwIDEgMCAxMyIvPjwvc3ZnPicsCnNlYXQ6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTUgNGgxNHY3YTQgNCAwIDAgMS00IDRIOWE0IDQgMCAwIDEtNC00VjR6Ii8+PHBhdGggZD0iTTkgMTV2NWg2di01Ii8+PC9zdmc+JywKcGluOic8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMCAxMGMwIDYtOCAxMi04IDEycy04LTYtOC0xMmE4IDggMCAwIDEgMTYgMHoiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSIzIi8+PC9zdmc+JywKdGlyZTonPHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOSIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMuNSIvPjxwYXRoIGQ9Ik0xMiAzdjUuNU0xMiAxNS41VjIxTTMgMTJoNS41TTE1LjUgMTJIMjEiLz48L3N2Zz4nLApib2x0Oic8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xMyAyIDMgMTRoN2wtMSA4IDEwLTEyaC03bDEtOHoiLz48L3N2Zz4nLAp0aGVybW86Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTE0IDE0Ljc2VjVhMiAyIDAgMSAwLTQgMHY5Ljc2YTQgNCAwIDEgMCA0IDB6Ii8+PC9zdmc+JywKY2FsOic8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjMiIHk9IjQiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjMiLz48cGF0aCBkPSJNMTYgMnY0TTggMnY0TTMgMTBoMTgiLz48L3N2Zz4nLApjYXI6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTUgMTMgNi41IDcuNUEyIDIgMCAwIDEgOC40IDZoNy4yYTIgMiAwIDAgMSAxLjkgMS41TDE5IDEzIi8+PHBhdGggZD0iTTQgMTNoMTZhMSAxIDAgMCAxIDEgMXYzYTEgMSAwIDAgMS0xIDFoLTFhMiAyIDAgMSAxLTQgMEg5YTIgMiAwIDEgMS00IDBINGExIDEgMCAwIDEtMS0xdi0zYTEgMSAwIDAgMSAxLTF6Ii8+PC9zdmc+JywKc2Nvb3RlcjonPHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iNSIgY3k9IjE4IiByPSIyLjQiLz48Y2lyY2xlIGN4PSIxOSIgY3k9IjE3IiByPSIyLjQiLz48cGF0aCBkPSJNNSAxOGgxMGw0LTEtMi41LTRIOU03IDloNE0xMiAxM1Y3bTAgMCAyIDIiLz48L3N2Zz4nLApwbHVnOic8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik05IDJ2Nk0xNSAydjZNNyA4aDEwdjRhNSA1IDAgMCAxLTEwIDBWOHpNMTIgMTd2NSIvPjwvc3ZnPicsCmNsb2NrOic8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjkiLz48cGF0aCBkPSJNMTIgN3Y1bDMgMyIvPjwvc3ZnPicsCndpZmk6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTUgMTIuNWExMCAxMCAwIDAgMSAxNCAwTTguNSAxNmE1IDUgMCAwIDEgNyAwIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxOSIgcj0iMSIgZmlsbD0iY3VycmVudENvbG9yIi8+PC9zdmc+JywKYWxlcnQ6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDl2NE0xMiAxN2guMDEiLz48cGF0aCBkPSJNMTAuMyAzLjkgMS44IDE4YTIgMiAwIDAgMCAxLjcgM2gxN2EyIDIgMCAwIDAgMS43LTNMMTMuNyAzLjlhMiAyIDAgMCAwLTMuNCAweiIvPjwvc3ZnPicsCndhcm46Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDMgMiAyMWgyMEwxMiAzeiIvPjxwYXRoIGQ9Ik0xMiAxMHY1TTEyIDE4aC4wMSIvPjwvc3ZnPicsCmt2Oic8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjMiIHk9IjUiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxNCIgcng9IjMiLz48cGF0aCBkPSJNNyA5aDNNMTQgMTVoM00xMCA5aC4wMU0xNyAxNWguMDEiLz48L3N2Zz4nLAprZXk6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iOCIgY3k9IjE1IiByPSI0LjUiLz48cGF0aCBkPSJNMTEuMiAxMS44IDIwIDNNMTYgN2wzIDNNMTMgMTBsMiAyIi8+PC9zdmc+JywKdXNlcnM6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iOSIgY3k9IjgiIHI9IjQiLz48cGF0aCBkPSJNMiAyMWE3IDcgMCAwIDEgMTQgME0xNiA0LjZhNCA0IDAgMCAxIDAgNi44TTE5IDIxYTYuNSA2LjUgMCAwIDAtMy01LjUiLz48L3N2Zz4nLAptYXA6Jzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTkgMyAzLjUgNXYxNkw5IDE5bDYgMiA1LjUtMlYzTDE1IDUgOSAzeiIvPjxwYXRoIGQ9Ik05IDN2MTZNMTUgNXYxNiIvPjwvc3ZnPicKfTsKCi8qID09PT09PT09PT09PT09PT09IOWfuuehgCBVSSA9PT09PT09PT09PT09PT09PSAqLwpsZXQgdG9hc3RUaW1lcj1udWxsOwpmdW5jdGlvbiB0b2FzdChtc2csdHlwZSl7Y29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInRvYXN0Iik7ZWwuY2xhc3NOYW1lPXR5cGV8fCJpbmZvIjtlbC5pbm5lckhUTUw9KHR5cGU9PT0iZXJyIj9JLng6dHlwZT09PSJvayI/SS5jaGVjazpJLndpZmkpKyc8c3Bhbj4nK2VzYyhtc2cpKyc8L3NwYW4+JztyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCk9PmVsLmNsYXNzTGlzdC5hZGQoInNob3ciKSk7Y2xlYXJUaW1lb3V0KHRvYXN0VGltZXIpO3RvYXN0VGltZXI9c2V0VGltZW91dCgoKT0+ZWwuY2xhc3NMaXN0LnJlbW92ZSgic2hvdyIpLDI2MDApfQpmdW5jdGlvbiBjb25maXJtRGlhbG9nKHRpdGxlLGRlc2Msb25ZZXMseWVzVHh0KXtjb25zdCBsYXllcj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiY29uZmlybUxheWVyIik7bGF5ZXIuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJjb25maXJtIj48ZGl2IGNsYXNzPSJjdCI+Jytlc2ModGl0bGUpKyc8L2Rpdj48ZGl2IGNsYXNzPSJjZCI+JytkZXNjKyc8L2Rpdj48ZGl2IGNsYXNzPSJjYiI+PGJ1dHRvbiBjbGFzcz0ibm8iIG9uY2xpY2s9ImNsb3NlQ29uZmlybSgpIj7lj5bmtog8L2J1dHRvbj48YnV0dG9uIGNsYXNzPSJ5ZXMiIG9uY2xpY2s9ImNsb3NlQ29uZmlybSgpOygnK29uWWVzKycpKCkiPicrZXNjKHllc1R4dHx8IuehruWumiIpKyc8L2J1dHRvbj48L2Rpdj48L2Rpdj4nO2xheWVyLmNsYXNzTGlzdC5yZW1vdmUoImhpZGRlbiIpfQpmdW5jdGlvbiBjbG9zZUNvbmZpcm0oKXtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiY29uZmlybUxheWVyIikuY2xhc3NMaXN0LmFkZCgiaGlkZGVuIil9CmZ1bmN0aW9uIG9wZW5TaGVldCh0aXRsZSxpY29uLGh0bWwpe2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJzaGVldFRpdGxlIikuaW5uZXJIVE1MPWljb24rJzxzcGFuPicrZXNjKHRpdGxlKSsnPC9zcGFuPic7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInNoZWV0Qm9keSIpLmlubmVySFRNTD1odG1sO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJzaGVldEJhY2tkcm9wIikuY2xhc3NMaXN0LmFkZCgic2hvdyIpO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJzaGVldCIpLmNsYXNzTGlzdC5hZGQoInNob3ciKTtkb2N1bWVudC5ib2R5LnN0eWxlLm92ZXJmbG93PSJoaWRkZW4ifQpmdW5jdGlvbiBjbG9zZVNoZWV0KCl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInNoZWV0QmFja2Ryb3AiKS5jbGFzc0xpc3QucmVtb3ZlKCJzaG93Iik7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInNoZWV0IikuY2xhc3NMaXN0LnJlbW92ZSgic2hvdyIpO2RvY3VtZW50LmJvZHkuc3R5bGUub3ZlcmZsb3c9IiJ9CmZ1bmN0aW9uIGZtdFRpbWUoaXNvKXt0cnl7Y29uc3QgZD1uZXcgRGF0ZShpc28pO2NvbnN0IHA9bj0+U3RyaW5nKG4pLnBhZFN0YXJ0KDIsIjAiKTtyZXR1cm4gZC5nZXRGdWxsWWVhcigpKyItIitwKGQuZ2V0TW9udGgoKSsxKSsiLSIrcChkLmdldERhdGUoKSkrIiAiK3AoZC5nZXRIb3VycygpKSsiOiIrcChkLmdldE1pbnV0ZXMoKSkrIjoiK3AoZC5nZXRTZWNvbmRzKCkpfWNhdGNoKGUpe3JldHVybiIifX0KCi8qID09PT09PT09PT09PT09PT09IOmhtemdouWIh+aNoiA9PT09PT09PT09PT09PT09PSAqLwpmdW5jdGlvbiBzd2l0Y2hUYWIodGFiKXsKICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCIudGFiIikuZm9yRWFjaCh0PT50LmNsYXNzTGlzdC50b2dnbGUoIm9uIix0LmRhdGFzZXQudGFiPT09dGFiKSk7CiAgY29uc3QgcGFnZXM9e2hvbWU6InBhZ2VIb21lIixsb2dzOiJwYWdlTG9ncyIsY2ZnOiJwYWdlQ2ZnIn07CiAgT2JqZWN0LmtleXMocGFnZXMpLmZvckVhY2goaz0+e2NvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHBhZ2VzW2tdKTtlbC5jbGFzc0xpc3QudG9nZ2xlKCJoaWRkZW4iLGshPT10YWIpfSk7CiAgaWYodGFiPT09ImxvZ3MiKXJlbmRlckxvZ3MoKTsKICBpZih0YWI9PT0iY2ZnIilyZW5kZXJDZmcoKTsKfQoKLyogPT09PT09PT09PT09PT09PT0g6Ieq5Yqo5Yi35pawID09PT09PT09PT09PT09PT09ICovCmxldCByZWZyZXNoVGltZXI9bnVsbCxyZWZyZXNoTGVmdD02MDsKZnVuY3Rpb24gc3RhcnRBdXRvUmVmcmVzaChzZWMpe3N0b3BBdXRvUmVmcmVzaCgpO3JlZnJlc2hMZWZ0PXNlY3x8Z2V0Q2ZnKCkuYXV0b1JlZnJlc2hTZWM7dXBkYXRlQ291bnRDaGlwKCk7cmVmcmVzaFRpbWVyPXNldEludGVydmFsKCgpPT57cmVmcmVzaExlZnQtLTtpZihyZWZyZXNoTGVmdDw9MCl7cmVmcmVzaExlZnQ9MDt1cGRhdGVDb3VudENoaXAoKTtyZWZyZXNoQWxsKHRydWUpfWVsc2UgdXBkYXRlQ291bnRDaGlwKCl9LDEwMDApfQpmdW5jdGlvbiBzdG9wQXV0b1JlZnJlc2goKXtpZihyZWZyZXNoVGltZXIpe2NsZWFySW50ZXJ2YWwocmVmcmVzaFRpbWVyKTtyZWZyZXNoVGltZXI9bnVsbH19CmZ1bmN0aW9uIHVwZGF0ZUNvdW50Q2hpcCgpe2NvbnN0IGNoaXA9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoImNvdW50Q2hpcCIpO2NvbnN0IHR4dD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiY291bnRUeHQiKTtjb25zdCBhcmM9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoImNvdW50QXJjIik7Y29uc3Qgc2VjPWdldENmZygpLmF1dG9SZWZyZXNoU2VjfHw2MDtpZighY2hpcClyZXR1cm47aWYocmVmcmVzaFRpbWVyKXtjaGlwLmNsYXNzTGlzdC5hZGQoIm9uIik7dHh0LnRleHRDb250ZW50PXJlZnJlc2hMZWZ0KyJzIjtjb25zdCBDPTIqTWF0aC5QSSo1LjY7YXJjLnNldEF0dHJpYnV0ZSgic3Ryb2tlLWRhc2hvZmZzZXQiLFN0cmluZyhDKigxLXJlZnJlc2hMZWZ0L3NlYykpKX1lbHNle2NoaXAuY2xhc3NMaXN0LnJlbW92ZSgib24iKTt0eHQudGV4dENvbnRlbnQ9IuaJi+WKqCJ9fQpmdW5jdGlvbiB0b2dnbGVBdXRvUmVmcmVzaCgpe2lmKHJlZnJlc2hUaW1lcilzdG9wQXV0b1JlZnJlc2goKTtlbHNlIHN0YXJ0QXV0b1JlZnJlc2goKTt1cGRhdGVDb3VudENoaXAoKX0KCi8qID09PT09PT09PT09PT09PT09IOS4i+aLieWIt+aWsCA9PT09PT09PT09PT09PT09PSAqLwooZnVuY3Rpb24oKXtjb25zdCB3cmFwPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJwdHJXcmFwIiksaW5kPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJwdHJJbmQiKSx0eHQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInB0clR4dCIpLHNwaW49ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInB0clNwaW4iKTtsZXQgc3RhcnRZPTAscHVsbGluZz1mYWxzZSxkaXN0YW5jZT0wO2NvbnN0IFRIPTY0Owp3cmFwLmFkZEV2ZW50TGlzdGVuZXIoInRvdWNoc3RhcnQiLGU9PntpZih3aW5kb3cuc2Nyb2xsWTw9MCYmZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInBhZ2VIb21lIikmJiFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicGFnZUhvbWUiKS5jbGFzc0xpc3QuY29udGFpbnMoImhpZGRlbiIpKXtzdGFydFk9ZS50b3VjaGVzWzBdLmNsaWVudFk7cHVsbGluZz10cnVlO2Rpc3RhbmNlPTB9fSx7cGFzc2l2ZTp0cnVlfSk7CndyYXAuYWRkRXZlbnRMaXN0ZW5lcigidG91Y2htb3ZlIixlPT57aWYoIXB1bGxpbmcpcmV0dXJuO2NvbnN0IGR5PWUudG91Y2hlc1swXS5jbGllbnRZLXN0YXJ0WTtpZihkeT4wJiZ3aW5kb3cuc2Nyb2xsWTw9MCl7ZGlzdGFuY2U9TWF0aC5taW4oZHkqMC41LDkwKTtpbmQuc3R5bGUuaGVpZ2h0PWRpc3RhbmNlKyJweCI7aW5kLmNsYXNzTGlzdC5hZGQoInB1bGxpbmciKTtzcGluLnN0eWxlLnRyYW5zZm9ybT0icm90YXRlKCIrKGRpc3RhbmNlKjMuNikrImRlZykiO3R4dC50ZXh0Q29udGVudD1kaXN0YW5jZT49VEg/IuadvuW8gOWIt+aWsCI6IuS4i+aLieWIt+aWsCI7aWYoZGlzdGFuY2U+PVRIJiYhZS5jYW5jZWxhYmxlKXJldHVybjtpZihkaXN0YW5jZT49VEgmJmUuY2FuY2VsYWJsZSllLnByZXZlbnREZWZhdWx0KCl9fSx7cGFzc2l2ZTpmYWxzZX0pOwp3cmFwLmFkZEV2ZW50TGlzdGVuZXIoInRvdWNoZW5kIiwoKT0+e2lmKCFwdWxsaW5nKXJldHVybjtwdWxsaW5nPWZhbHNlO2lmKGRpc3RhbmNlPj1USCl7dHh0LnRleHRDb250ZW50PSLliLfmlrDkuK3igKYiO2luZC5zdHlsZS5oZWlnaHQ9IjQ2cHgiO3NwaW4uY2xhc3NMaXN0LmFkZCgic3Bpbm5lciIpO3JlZnJlc2hBbGwodHJ1ZSkuZmluYWxseSgoKT0+e2luZC5zdHlsZS5oZWlnaHQ9IjAiO2luZC5jbGFzc0xpc3QucmVtb3ZlKCJwdWxsaW5nIil9KX1lbHNle2luZC5zdHlsZS5oZWlnaHQ9IjAifWRpc3RhbmNlPTB9LHtwYXNzaXZlOnRydWV9KTsKfSkoKTsKCi8qID09PT09PT09PT09PT09PT09IOmmlumhtea4suafkyA9PT09PT09PT09PT09PT09PSAqLwpsZXQgU1RBVEU9e2RhdGE6W10sdGltZXN0YW1wOiIiLHRzVGV4dDoiIixyZWZyZXNoU2VjOjYwLHByb3h5OmZhbHNlLHBhbmVsQWNjb3VudHM6bnVsbCxwYW5lbExvYWRlZDpmYWxzZX07CmZ1bmN0aW9uIHNrZWxldG9uSG9tZSgpe3JldHVybiAnPGRpdiBjbGFzcz0iaGVybyIgc3R5bGU9ImhlaWdodDoxMzJweCI+PC9kaXY+JysKJzxkaXYgY2xhc3M9InNrLWNhcmQiPjxkaXYgY2xhc3M9InNrLWxpbmUgdzQwIj48L2Rpdj48ZGl2IGNsYXNzPSJzay1yb3ciPicrQXJyYXkoNCkuZmlsbCgnPGRpdiBjbGFzcz0ic2stY2VsbCI+PC9kaXY+Jykuam9pbigiIikrJzwvZGl2PjxkaXYgY2xhc3M9InNrLWJhciB3ODAiPjwvZGl2PjwvZGl2PicrCic8ZGl2IGNsYXNzPSJzay1jYXJkIj48ZGl2IGNsYXNzPSJzay1saW5lIHc2MCI+PC9kaXY+PGRpdiBjbGFzcz0ic2stcm93Ij4nK0FycmF5KDQpLmZpbGwoJzxkaXYgY2xhc3M9InNrLWNlbGwiPjwvZGl2PicpLmpvaW4oIiIpKyc8L2Rpdj48ZGl2IGNsYXNzPSJzay1iYXIgdzgwIj48L2Rpdj48L2Rpdj4nfQpmdW5jdGlvbiBzY29vdGVyRmFsbGJhY2soKXtyZXR1cm4gJzxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIxLjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iNSIgY3k9IjE4IiByPSIyLjQiLz48Y2lyY2xlIGN4PSIxOSIgY3k9IjE3IiByPSIyLjQiLz48cGF0aCBkPSJNNSAxOGgxMGw0LTEtMi41LTRIOU03IDloNE0xMiAxM1Y3bTAgMCAyIDIiLz48L3N2Zz4nfQoKZnVuY3Rpb24gcmVuZGVySG9tZSgpewogIGNvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJwYWdlSG9tZSIpO2NvbnN0IGRhdGE9U1RBVEUuZGF0YTsKICBlbC5pbm5lckhUTUw9c2tlbGV0b25Ib21lKCk7CiAgaWYoZGF0YS5sZW5ndGg9PT0wKXsKICAgIGVsLmlubmVySFRNTD0nPGRpdiBjbGFzcz0iZW1wdHkiPjxkaXYgY2xhc3M9ImUtaWNvbiI+JytJLmNhcisnPC9kaXY+PGgzPui/mOayoeacieaegeaguOi0puWPtzwvaDM+PHA+5Y6744CM6K6+572u44CN6aG15re75Yqg6LSm5Y+377ya57KY6LS05oqT5YyF5b6X5Yiw55qEIEF1dGhvcml6YXRpb24gVG9rZW7vvIhCZWFyZXIg5YmN57yA5Lya6Ieq5Yqo5Y675o6J77yJ77yM5YaN54K544CM6I635Y+WSUTjgI3ljbPlj6/oh6rliqjloavlhYXnlKjmiLdJROOAgjwvcD48YnV0dG9uIGNsYXNzPSJidG4gcHJpbWFyeSIgb25jbGljaz0ic3dpdGNoVGFiKFwnY2ZnXCcpIj7ljrvmt7vliqDotKblj7c8L2J1dHRvbj48L2Rpdj4nOwogICAgcmV0dXJuOwogIH0KICBjb25zdCB0b3RhbFNjb3JlPWRhdGEucmVkdWNlKChzLGEpPT5zKyhhLnNjb3JlfHwwKSwwKTsKICBjb25zdCBzaWduZWRDb3VudD1kYXRhLmZpbHRlcihhPT5hLnNpZ25lZFRvZGF5KS5sZW5ndGg7CiAgY29uc3QgY2FyZHM9ZGF0YS5tYXAoKGEsaWR4KT0+cmVuZGVyQWNjb3VudENhcmQoYSxpZHgpKS5qb2luKCIiKTsKICBjb25zdCBwcm94eUhpbnQ9U1RBVEUucHJveHk/JzxkaXYgY2xhc3M9ImNmZy1ub3RlIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4Ij48Yj4nKyh3aW5kb3cuX19QQU5FTF9NT0RFX18/Iumdouadv+aooeW8jyI6IuS7o+eQhuaooeW8jyIpKyc8L2I+77ya5pWw5o2u55Sx5pys5py66ISa5pys5ZCO56uv562+5ZCN5LiO6I635Y+W44CCPC9kaXY+JzoiIjsKICBlbC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Imhlcm8iPjxkaXYgY2xhc3M9Imhlcm8tdG9wIj48ZGl2IGNsYXNzPSJoZXJvLXNjb3JlIj48ZGl2IGNsYXNzPSJsYmwiPui0puWPt+aAu+enr+WIhjwvZGl2PjxkaXYgY2xhc3M9InZhbCBudW0iIGlkPSJ0b3RhbFNjb3JlIj4nK3RvdGFsU2NvcmUudG9Mb2NhbGVTdHJpbmcoKSsnPC9kaXY+PC9kaXY+PGRpdiBjbGFzcz0iaGVyby1yaWdodCI+PGRpdiBjbGFzcz0iYmlnIG51bSI+JytzaWduZWRDb3VudCsnPHNwYW4+IC8gJytkYXRhLmxlbmd0aCsnPC9zcGFuPjwvZGl2PjxkaXYgY2xhc3M9InN1YiI+5LuK5pel5bey562+5YiwPC9kaXY+PC9kaXY+PC9kaXY+PGRpdiBjbGFzcz0iaGVyby1zdGF0cyI+PGRpdiBjbGFzcz0iaHN0YXQgY3lhbiI+PGRpdiBjbGFzcz0idiBudW0iPicrZGF0YS5maWx0ZXIoYT0+YS52ZWhpY2xlJiZhLnZlaGljbGUuaGFzVmVoaWNsZSkubGVuZ3RoKyc8L2Rpdj48ZGl2IGNsYXNzPSJsIj7nu5HlrprovabovoY8L2Rpdj48L2Rpdj48ZGl2IGNsYXNzPSJoc3RhdCBncmVlbiI+PGRpdiBjbGFzcz0idiBudW0iPicrZGF0YS5maWx0ZXIoYT0+YS50b2tlblZhbGlkIT09ZmFsc2UpLmxlbmd0aCsnPC9kaXY+PGRpdiBjbGFzcz0ibCI+VG9rZW4g5q2j5bi4PC9kaXY+PC9kaXY+PC9kaXY+PC9kaXY+JwogICtwcm94eUhpbnQKICArJzxkaXYgY2xhc3M9InNlY3Rpb24tdGl0bGUiPicrSS5jYXIrJ+i0puWPt+eKtuaAgTwvZGl2PicrY2FyZHMKICArJzxkaXYgY2xhc3M9ImZvb3QiPuaegeaguCBaRUVITyDpnaLmnb8gJytBUFBfVkVSU0lPTisnIMK3IOaVsOaNruabtOaWsCAnK2VzYyhTVEFURS50c1RleHR8fCItIikrJzxicj48YSBjbGFzcz0ibGluayIgaHJlZj0iaHR0cHM6Ly9naXRodWIuY29tL21saW5rNzk4L1pFRUhPIiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+5L2c6ICFIGx1Y2t5IMK3IEdpdEh1YjwvYT4gwrcgPGEgY2xhc3M9ImxpbmsiIGhyZWY9Imh0dHBzOi8vYWZkaWFuLmNvbS9hL2x1Y2t5Nzk4IiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+54ix5Y+R55S1PC9hPiDCtyDku4XkvpvlrabkuaDnoJTnqbY8L2Rpdj4nOwp9CgpmdW5jdGlvbiByaW5nU3ZnKHBjdCxzaXplKXtjb25zdCByPXNpemUvMi02O2NvbnN0IEM9MipNYXRoLlBJKnI7Y29uc3Qgb2ZmPUMqKDEtTWF0aC5tYXgoMCxNYXRoLm1pbigxMDAscGN0KSkvMTAwKTtjb25zdCBjb2w9cGN0PD0yMD8iI0Y5NzA2QSI6cGN0PD01MD8iI0Y3Qjk1NSI6IiMyQkQ0RjIiO3JldHVybiAnPGRpdiBjbGFzcz0idmVoaWNsZS1yaW5nIj48c3ZnIHZpZXdCb3g9IjAgMCAnK3NpemUrJyAnK3NpemUrJyI+PGNpcmNsZSBjbGFzcz0idHJhY2siIGN4PSInK3NpemUvMisnIiBjeT0iJytzaXplLzIrJyIgcj0iJytyKyciLz48Y2lyY2xlIGNsYXNzPSJhcmMiIGN4PSInK3NpemUvMisnIiBjeT0iJytzaXplLzIrJyIgcj0iJytyKyciIHN0cm9rZT0iJytjb2wrJyIgc3Ryb2tlLWRhc2hhcnJheT0iJytDLnRvRml4ZWQoMSkrJyIgc3Ryb2tlLWRhc2hvZmZzZXQ9Iicrb2ZmLnRvRml4ZWQoMSkrJyIvPjwvc3ZnPjxkaXYgY2xhc3M9InBjdCIgc3R5bGU9ImNvbG9yOicrY29sKyciPicrTWF0aC5yb3VuZChwY3QpKyclPC9kaXY+PC9kaXY+J30KZnVuY3Rpb24gcG93ZXJUZXh0KHAsbCl7cD1TdHJpbmcocHx8IiIpLnRvTG93ZXJDYXNlKCkudHJpbSgpO2w9U3RyaW5nKGx8fCIiKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtjb25zdCBvblZhbHM9WyIxIiwib24iLCJ0cnVlIiwi5byA5py6Iiwib3BlbiIsIua/gOa0uyIsImFjY19vbiIsImFjYyBvbiIsInBvd2VyX29uIiwicG93ZXIgb24iLCLlt7LlvIDmnLoiLCLlt7LkuIrnlLUiXTtjb25zdCBvZmZWYWxzPVsiMCIsIm9mZiIsImZhbHNlIiwi5YWz5py6IiwiY2xvc2VkIiwi5b6F5py6IiwiYWNjX29mZiIsImFjYyBvZmYiLCJwb3dlcl9vZmYiLCJwb3dlciBvZmYiLCLlt7LlhbPmnLoiLCLlt7LkuIvnlLUiXTtpZihwKXtpZihvblZhbHMuaW5jbHVkZXMocCkpcmV0dXJue3RleHQ6IuW3suW8gOacuiIsY2xzOiJvbiJ9O2lmKG9mZlZhbHMuaW5jbHVkZXMocCkpcmV0dXJue3RleHQ6IuW3suWFs+acuiIsY2xzOiJvZmYifX1pZihsKXtpZihbIjAiLCLmnKrplIEiLCLlvIDplIEiLCJ1bmxvY2tlZCIsImZhbHNlIiwib3BlbiIsIuW3suW8gOmUgSIsIuacqumUgei9piJdLmluY2x1ZGVzKGwpKXJldHVybnt0ZXh0OiLlt7LlvIDmnLoiLGNsczoib24ifTtpZihbIjEiLCLlt7LplIEiLCLplIHovaYiLCJsb2NrZWQiLCJ0cnVlIiwiY2xvc2VkIiwi5bey6ZSB6L2mIl0uaW5jbHVkZXMobCkpcmV0dXJue3RleHQ6IuW3suWFs+acuiIsY2xzOiJvZmYifX1yZXR1cm57dGV4dDoi54q25oCB5pyq55+lIixjbHM6Im9mZiJ9fQpmdW5jdGlvbiBvbmxpbmVUZXh0KG8pe2NvbnN0IHM9U3RyaW5nKG98fCIiKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtpZighcylyZXR1cm4iIjtpZihbIjEiLCJvbiIsIm9ubGluZSIsInRydWUiLCLlnKjnur8iLCLlt7LlnKjnur8iLCJjb25uZWN0ZWQiLCJub3JtYWwiXS5pbmNsdWRlcyhzKSlyZXR1cm4i5Zyo57q/IjtpZihbIjAiLCJvZmYiLCJvZmZsaW5lIiwiZmFsc2UiLCLnprvnur8iLCLmnKrlnKjnur8iLCLlt7Lnprvnur8iLCJkaXNjb25uZWN0IiwiZGlzY29ubmVjdGVkIiwic2xlZXAiLCLkvJHnnKAiXS5pbmNsdWRlcyhzKSlyZXR1cm4i56a757q/IjtyZXR1cm4gc30KZnVuY3Rpb24gbG9ja1RleHQobCl7Y29uc3Qgcz1TdHJpbmcobHx8IiIpLnRvTG93ZXJDYXNlKCkudHJpbSgpO2lmKCFzKXJldHVybiIiO2lmKFsiMCIsIuacqumUgSIsIuW8gOmUgSIsInVubG9ja2VkIiwiZmFsc2UiLCJvcGVuIiwi5bey5byA6ZSBIiwi5pyq6ZSB6L2mIl0uaW5jbHVkZXMocykpcmV0dXJue3RleHQ6IuacqumUgei9piIsY2xzOiJ1bmxvY2tlZCJ9O2lmKFsiMSIsIuW3sumUgSIsIumUgei9piIsImxvY2tlZCIsInRydWUiLCJjbG9zZWQiLCLlt7LplIHovaYiXS5pbmNsdWRlcyhzKSlyZXR1cm57dGV4dDoi5bey6ZSB6L2mIixjbHM6ImxvY2tlZCJ9O3JldHVybnt0ZXh0OnMsY2xzOiJvZmYifX0KZnVuY3Rpb24gY3VzaGlvblRleHQoYyl7Y29uc3Qgcz1TdHJpbmcoY3x8IiIpLnRyaW0oKTtpZighcylyZXR1cm4iIjtpZihbIjEiLCJvcGVuIiwib3BlbmVkIiwib24iLCJ0cnVlIiwi5byAIiwi5bey5byAIiwi5omT5byAIiwi5by55byAIl0uaW5jbHVkZXMocy50b0xvd2VyQ2FzZSgpKSlyZXR1cm4i5Z2Q5Z6r5bey5byAIjtpZihbIjAiLCJjbG9zZSIsImNsb3NlZCIsIm9mZiIsImZhbHNlIiwi5YWzIiwi5bey5YWzIiwi6Zet5ZCIIiwi5YWz6ZetIl0uaW5jbHVkZXMocy50b0xvd2VyQ2FzZSgpKSlyZXR1cm4i5Z2Q5Z6r5bey5ZCIIjtyZXR1cm4i5Z2Q5Z6rwrciK3N9CgpmdW5jdGlvbiByZW5kZXJBY2NvdW50Q2FyZChhLGlkeCl7CiAgY29uc3Qgdj1hLnZlaGljbGV8fHt9OwogIGNvbnN0IGJsaW5kRGF5PWEuY29udGludWVEYXlzPT09MD8wOigoYS5jb250aW51ZURheXMtMSklMzApKzE7CiAgY29uc3QgYmxpbmRSb3VuZD1hLmNvbnRpbnVlRGF5cz09PTA/MDpNYXRoLmNlaWwoYS5jb250aW51ZURheXMvMzApOwogIGNvbnN0IGJsaW5kUGN0PU1hdGgucm91bmQoKGJsaW5kRGF5LzMwKSoxMDApOwogIGNvbnN0IGJsaW5kUmVtYWluPTMwLWJsaW5kRGF5OwogIGNvbnN0IHdlZWs9YS5sYXN0NyYmYS5sYXN0Ny5sZW5ndGg/YS5sYXN0Ny5tYXAoZD0+JzxkaXYgY2xhc3M9ImRheSAnKyhkLnNpZ25lZD8ib2siOiIiKSsiICIrKGQuaXNUb2RheT8idG9kYXkiOiIiKSsnIiB0aXRsZT0iJytkLmRhdGUrJyI+PHNwYW4gY2xhc3M9ImQiPicrZC5kYXRlLnNsaWNlKDMpKyc8L3NwYW4+PHNwYW4gY2xhc3M9Im0iPicrKGQuc2lnbmVkPyLinJMiOiLigJQiKSsnPC9zcGFuPjwvZGl2PicpLmpvaW4oIiIpOiIiOwogIGNvbnN0IGlzQ2hhcmdpbmc9di5jaGFyZ2VTdGF0ZSYmdi5jaGFyZ2VTdGF0ZSE9PSLmnKrlhYXnlLUiOwogIGxldCBjaGFyZ2VFdGE9IiI7CiAgaWYoaXNDaGFyZ2luZyYmdi52b2x0YWdlJiZ2LmN1cnJlbnQmJnYuY3VycmVudD4wJiZ2LmJhdHRlcnlQZXJjZW50PDEwMCl7Y29uc3QgcmVtYWluV2g9KDEwMC12LmJhdHRlcnlQZXJjZW50KS8xMDAqMTQ0MDtjb25zdCBwb3dlclc9di52b2x0YWdlKnYuY3VycmVudDtjb25zdCBob3Vycz1yZW1haW5XaC9wb3dlclc7Y2hhcmdlRXRhPWhvdXJzPj0xPyLnuqYiK2hvdXJzLnRvRml4ZWQoMSkrIuWwj+aXtuWFhea7oSI6Iue6piIrTWF0aC5yb3VuZChob3Vycyo2MCkrIuWIhumSn+WFhea7oSJ9CiAgY29uc3QgcHc9cG93ZXJUZXh0KHYucG93ZXJTdGF0dXMsdi5sb2NrU3RhdGUpOwogIGNvbnN0IG9ubD1vbmxpbmVUZXh0KHYub25saW5lfHx2LnJpZGVTdGF0ZSk7CiAgY29uc3QgbGs9bG9ja1RleHQodi5sb2NrU3RhdGUpOwogIGNvbnN0IGNzPWN1c2hpb25UZXh0KHYuY3VzaGlvblN0YXRlKTsKICBjb25zdCBjb29yZE9rPWhhc1ZhbGlkQ29vcmQodi5sYXRpdHVkZSx2LmxvbmdpdHVkZSk7CiAgY29uc3Qgc29jQ29sPXYuYmF0dGVyeVBlcmNlbnQ8PTIwPyIjRjk3MDZBIjp2LmJhdHRlcnlQZXJjZW50PD01MD8iI0Y3Qjk1NSI6IiMyQkQ0RjIiOwogIGNvbnN0IGFjY0NvbG9yPShhLnVzZXJOYW1lfHwiPyIpLmNoYXJDb2RlQXQoMCklMj09PTA/IiI6InZpbyI7CiAgY29uc3QgdWlkU2hvcnQ9YS51c2VySWQ/IklEICIrU3RyaW5nKGEudXNlcklkKS5zbGljZSgtNik6IuacquWhq0lEIjsKICBjb25zdCBiYWRnZT1hLnNpZ25lZFRvZGF5Pyc8c3BhbiBjbGFzcz0icGlsbCBvayI+JytJLmNoZWNrKyflt7Lnrb7liLA8L3NwYW4+JzonPHNwYW4gY2xhc3M9InBpbGwgbWlzcyI+5pyq562+5YiwPC9zcGFuPic7CiAgY29uc3QgdG9rQmFkZ2U9YS50b2tlblZhbGlkPT09ZmFsc2U/JzxzcGFuIGNsYXNzPSJwaWxsIGVyciIgc3R5bGU9ImJhY2tncm91bmQ6dmFyKC0tZXJyU29mdCk7Y29sb3I6dmFyKC0tZXJyKSI+JytJLmFsZXJ0KyflpLHmlYg8L3NwYW4+JzonPHNwYW4gY2xhc3M9InBpbGwgY3lhbiI+VG9rZW4g5q2j5bi4PC9zcGFuPic7CiAgY29uc3QgZXJySHRtbD0iIjsKICBjb25zdCB2ZWhTdz12Lmhhc1ZlaGljbGU/cmVuZGVyVmVoaWNsZVN3aXRjaCh2LGlkeCk6IiI7CiAgY29uc3Qgdkh0bWw9di5oYXNWZWhpY2xlP3JlbmRlclZlaGljbGVIdG1sKHYsaWR4LGlzQ2hhcmdpbmcsY2hhcmdlRXRhLHB3LG9ubCxsayxjcyxjb29yZE9rLHNvY0NvbCk6JzxkaXYgY2xhc3M9Im5vLXZlaGljbGUiIHN0eWxlPSJtYXJnaW4tdG9wOjEycHgiPicrSS5jYXIrJyDor6XotKblj7fmnKrnu5HlrprovabovoY8L2Rpdj4nOwogIHJldHVybiAnPGRpdiBjbGFzcz0iYWNjLWNhcmQiIHN0eWxlPSJhbmltYXRpb24tZGVsYXk6JysoaWR4KjYwKSsnbXMiPicrCiAgICAnPGRpdiBjbGFzcz0iYWNjLWhlYWQiPjxkaXYgY2xhc3M9ImF2YXRhciAnK2FjY0NvbG9yKyciPicrZXNjKChhLnVzZXJOYW1lfHwiPyIpWzBdLnRvVXBwZXJDYXNlKCkpKyc8L2Rpdj4nKwogICAgJzxkaXYgY2xhc3M9ImFjYy1pbmZvIj48ZGl2IGNsYXNzPSJhY2MtbmFtZSI+Jytlc2MoYS51c2VyTmFtZSkrJzwvZGl2PjxkaXYgY2xhc3M9ImFjYy1zdWIiPicrdWlkU2hvcnQrJzwvZGl2PjwvZGl2PicrCiAgICAnPGRpdiBjbGFzcz0iYWNjLWFjdGlvbnMiPicrdG9rQmFkZ2UrYmFkZ2UrJzwvZGl2PjwvZGl2PicrZXJySHRtbCsKICAgICc8ZGl2IGNsYXNzPSJrcGktZ3JpZCI+PGRpdiBjbGFzcz0ia3BpIGMxIj48ZGl2IGNsYXNzPSJ2IG51bSI+JytOdW1iZXIoYS5zY29yZXx8MCkudG9Mb2NhbGVTdHJpbmcoKSsnPC9kaXY+PGRpdiBjbGFzcz0ibCI+5oC756ev5YiGPC9kaXY+PC9kaXY+JysKICAgICc8ZGl2IGNsYXNzPSJrcGkgYzIiPjxkaXYgY2xhc3M9InYgbnVtIj4rJytOdW1iZXIoYS50b2RheVNjb3JlfHwwKSsnPC9kaXY+PGRpdiBjbGFzcz0ibCI+5LuK5pel56ev5YiGPC9kaXY+PC9kaXY+JysKICAgICc8ZGl2IGNsYXNzPSJrcGkgYzMiPjxkaXYgY2xhc3M9InYgbnVtIj4nK051bWJlcihhLmNvbnRpbnVlRGF5c3x8MCkrJzwvZGl2PjxkaXYgY2xhc3M9ImwiPui/nuetvuWkqeaVsDwvZGl2PjwvZGl2PicrCiAgICAnPGRpdiBjbGFzcz0ia3BpIGM0Ij48ZGl2IGNsYXNzPSJ2IG51bSI+JytibGluZFJlbWFpbisnPC9kaXY+PGRpdiBjbGFzcz0ibCI+6Led55uy55uSPC9kaXY+PC9kaXY+PC9kaXY+JysKICAgICc8ZGl2IGNsYXNzPSJibGluZCI+PGRpdiBjbGFzcz0iYmxpbmQtdG9wIj48c3Bhbj7nm7Lnm5Lov5vluqbvvIjnrKwnK2JsaW5kUm91bmQrJ+i9ru+8iTwvc3Bhbj48c3BhbiBjbGFzcz0iciBudW0iPicrYmxpbmREYXkrJyAvIDMwIMK3ICcrYmxpbmRQY3QrJyU8L3NwYW4+PC9kaXY+PGRpdiBjbGFzcz0iYmxpbmQtYmFyIj48ZGl2IGNsYXNzPSJibGluZC1maWxsIiBzdHlsZT0id2lkdGg6JytibGluZFBjdCsnJSI+PC9kaXY+PC9kaXY+PC9kaXY+JysKICAgICc8ZGl2IGNsYXNzPSJ3ZWVrIj48ZGl2IGNsYXNzPSJ3ZWVrLXRvcCI+PHNwYW4+6L+RIDcg5aSp562+5YiwPC9zcGFuPjwvZGl2PjxkaXYgY2xhc3M9IndlZWstZ3JpZCI+Jyt3ZWVrKyc8L2Rpdj48L2Rpdj4nKwogICAgdmVoU3crdkh0bWwrCiAgICAnPGRpdiBjbGFzcz0iY3RybC1ncmlkIj4nKwogICAgJzxidXR0b24gY2xhc3M9ImN0cmwtYnRuIiBkYXRhLWFjdD0iZmluZCIgb25jbGljaz0iY3RybEFjdCgnK2lkeCsnLFwnZmluZFwnLHRoaXMpIj4nK0kuYmVsbCsn5a+76L2mPC9idXR0b24+JysKICAgICc8YnV0dG9uIGNsYXNzPSJjdHJsLWJ0biIgZGF0YS1hY3Q9ImxvdWRGaW5kIiBvbmNsaWNrPSJjdHJsQWN0KCcraWR4KycsXCdsb3VkRmluZFwnLHRoaXMpIj4nK0kudm9sKyfpuKPnrJs8L2J1dHRvbj4nKwogICAgJzxidXR0b24gY2xhc3M9ImN0cmwtYnRuIiBkYXRhLWFjdD0iY3VzaGlvbiIgb25jbGljaz0iY3RybEFjdCgnK2lkeCsnLFwnY3VzaGlvblwnLHRoaXMpIj4nK0kuc2VhdCsn5Z2Q5Z6rPC9idXR0b24+JysKICAgICc8YnV0dG9uIGNsYXNzPSJjdHJsLWJ0biB1bmxvY2siIGRhdGEtYWN0PSJ1bmxvY2siIG9uY2xpY2s9ImN0cmxBY3QoJytpZHgrJyxcJ3VubG9ja1wnLHRoaXMpIj4nK0kudW5sb2NrKyflvIDplIE8L2J1dHRvbj4nKwogICAgJzxidXR0b24gY2xhc3M9ImN0cmwtYnRuIGxvY2siIGRhdGEtYWN0PSJsb2NrIiBvbmNsaWNrPSJjdHJsQWN0KCcraWR4KycsXCdsb2NrXCcsdGhpcykiPicrSS5sb2NrKyflhbPplIE8L2J1dHRvbj4nKwogICAgJzwvZGl2PjwvZGl2Pic7Cn0KCi8qID09PT09PT09PT09PSDlpJrovabliIfmjaIgPT09PT09PT09PT09ICovCmZ1bmN0aW9uIHJlbmRlclZlaGljbGVTd2l0Y2godixpZHgpewogIGlmKCF2LnZlaGljbGVzfHx2LnZlaGljbGVzLmxlbmd0aDwyKXJldHVybiAiIjsKICBjb25zdCBjdXI9di5jdXJyZW50VmlufHwiIjsKICBjb25zdCBpdGVtcz12LnZlaGljbGVzLm1hcCh4PT4nPGJ1dHRvbiBjbGFzcz0idmVoLWNoaXAnKyh4LnZpbk5vPT09Y3VyPyIgb24iOiIiKSsnIiBvbmNsaWNrPSJzd2l0Y2hWZWhpY2xlKCcraWR4KycsXCcnK2VzYyh4LnZpbk5vKSsnXCcpIj4nK2VzYyh4Lm5hbWUpKyc8L2J1dHRvbj4nKS5qb2luKCIiKTsKICByZXR1cm4gJzxkaXYgY2xhc3M9InZlaC1zd2l0Y2giPjxzcGFuIGNsYXNzPSJ2ZWgtc3ctbGFiZWwiPui9pui+hjwvc3Bhbj4nK2l0ZW1zKyc8L2Rpdj4nOwp9CmFzeW5jIGZ1bmN0aW9uIHN3aXRjaFZlaGljbGUoaWR4LHZpbil7CiAgY29uc3Qgc3JjPVNUQVRFLmRhdGFbaWR4XTtpZighc3JjfHwhdmluKXJldHVybjsKICB0cnl7CiAgICBsZXQgZDsKICAgIGlmKGlzUHJveHlNb2RlKCkpewogICAgICBjb25zdCByPWF3YWl0IHByb3h5RmV0Y2goIi9hcGkvdmVoaWNsZT91c2VySWQ9IitlbmNvZGVVUklDb21wb25lbnQoc3JjLnVzZXJJZHx8IiIpKyImdmluPSIrZW5jb2RlVVJJQ29tcG9uZW50KHZpbikpOwogICAgICBkPShyJiZyLm9rKT9yLnJlc3VsdDpudWxsOwogICAgfWVsc2V7CiAgICAgIGNvbnN0IGNmZz1nZXRDZmcoKTtjb25zdCBhY2M9Z2V0QWNjb3VudHMoKVtpZHhdOwogICAgICBpZighYWNjKXJldHVybjsKICAgICAgZD1hd2FpdCBmZXRjaEFjY291bnREYXRhKGFjYyxjZmcsdmluKTsKICAgIH0KICAgIGlmKGQmJmQudmVoaWNsZSYmZC52ZWhpY2xlLmhhc1ZlaGljbGUpewogICAgICBTVEFURS5kYXRhW2lkeF09T2JqZWN0LmFzc2lnbih7fSxTVEFURS5kYXRhW2lkeF0sZCk7CiAgICAgIHJlbmRlckhvbWUoKTsKICAgIH0KICB9Y2F0Y2goZSl7fQp9CgovKiA9PT09PT09PT09PT0g55qu6IKkL+S4u+mimOWIh+aNoiA9PT09PT09PT09PT0gKi8KY29uc3QgVEhFTUVTPVsiZGFyayIsImxpZ2h0IiwiZ3JlZW4iLCJ2aW9sZXQiLCJhbWJlciJdOwpjb25zdCBUTEFCRUw9e2Rhcms6Iua3seiTnSIsbGlnaHQ6Iua1heiJsiIsZ3JlZW46Iue/oee/oCIsdmlvbGV0OiLntKvnvZflhbAiLGFtYmVyOiLnkKXnj4AifTsKZnVuY3Rpb24gdGhlbWVMYWJlbCh0KXtyZXR1cm4gVExBQkVMW3RdfHx0fQpmdW5jdGlvbiB0b2dnbGVUaGVtZSgpewogIGNvbnN0IGN1cj1kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCJkYXRhLXRoZW1lIil8fCJkYXJrIjsKICBjb25zdCBpPVRIRU1FUy5pbmRleE9mKGN1cik7Y29uc3QgbmV4dD1USEVNRVNbKGk8MD8wOmkrMSklVEhFTUVTLmxlbmd0aF07CiAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNldEF0dHJpYnV0ZSgiZGF0YS10aGVtZSIsbmV4dCk7CiAgdHJ5e2xvY2FsU3RvcmFnZS5zZXRJdGVtKCJ6ZWVob190aGVtZSIsbmV4dCl9Y2F0Y2goZSl7fQogIGNvbnN0IGI9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInRoZW1lRmFiIik7aWYoYiliLnRpdGxlPSLkuLvpopjvvJoiK3RoZW1lTGFiZWwobmV4dCkrIu+8iOeCueWHu+WIh+aNou+8iSI7Cn0KZnVuY3Rpb24gYXBwbHlUaGVtZSgpewogIGxldCB0PSJkYXJrIjsKICB0cnl7dD1sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgiemVlaG9fdGhlbWUiKXx8ImRhcmsifWNhdGNoKGUpe30KICBpZihUSEVNRVMuaW5kZXhPZih0KTwwKXQ9ImRhcmsiOwogIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zZXRBdHRyaWJ1dGUoImRhdGEtdGhlbWUiLHQpOwogIGNvbnN0IGI9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInRoZW1lRmFiIik7aWYoYiliLnRpdGxlPSLkuLvpopjvvJoiK3RoZW1lTGFiZWwodCkrIu+8iOeCueWHu+WIh+aNou+8iSI7Cn0KZnVuY3Rpb24gbW91bnRUaGVtZUJ0bigpewogIGlmKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJ0aGVtZUZhYiIpKXJldHVybjsKICBjb25zdCBiPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoImJ1dHRvbiIpOwogIGIuaWQ9InRoZW1lRmFiIjtiLmNsYXNzTmFtZT0idGhlbWUtZmFiIjtiLnRleHRDb250ZW50PSJcdXsxRjMxOX0iOwogIGIudGl0bGU9IuS4u+mimO+8mua3seiTne+8iOeCueWHu+WIh+aNou+8iSI7Yi5vbmNsaWNrPXRvZ2dsZVRoZW1lOwogIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYik7Cn0KCgoKZnVuY3Rpb24gcmVuZGVyVmVoaWNsZUh0bWwodixpZHgsaXNDaGFyZ2luZyxjaGFyZ2VFdGEscHcsb25sLGxrLGNzLGNvb3JkT2ssc29jQ29sKXsKICBsZXQgaD0nPGRpdiBjbGFzcz0idmVoaWNsZSIgb25jbGljaz0ic2hvd1ZlaGljbGVEZXRhaWwoJytpZHgrJykiPicrCiAgJzxkaXYgY2xhc3M9InZlaGljbGUtdG9wIj4nK3JpbmdTdmcodi5iYXR0ZXJ5UGVyY2VudCw3NCkrCiAgJzxkaXYgY2xhc3M9InZlaGljbGUtbWV0YSI+PGRpdiBjbGFzcz0idmVoaWNsZS1uYW1lIj4nK2VzYyh2LnZlaGljbGVOYW1lfHwi5p6B5qC46L2m6L6GIikrJzwvZGl2PicrCiAgJzxkaXYgY2xhc3M9InZlaGljbGUtdmluIj48c3BhbiBpZD0idmluVHh0XycraWR4KyciPicrZXNjKG1hc2tWaW4odi52aW5ObykpKyc8L3NwYW4+PGJ1dHRvbiBjbGFzcz0idmluLXNob3ciIGlkPSJ2aW5CdG5fJytpZHgrJyIgb25jbGljaz0iZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7dG9nZ2xlVmluKCcraWR4KycpIj7mmL7npLo8L2J1dHRvbj48L2Rpdj4nKwogICc8ZGl2IGNsYXNzPSJ2ZWhpY2xlLWJhZGdlcyI+JysKICAob25sPyc8c3BhbiBjbGFzcz0icGlsbCAnKyhvbmw9PT0i5Zyo57q/Ij8ib2siOiJncmF5IikrJyI+JytJLndpZmkrKG9ubD09PSLlnKjnur8iPyIg5Zyo57q/IjoiICIrb25sKSsnPC9zcGFuPic6IiIpKwogIChpc0NoYXJnaW5nPyc8c3BhbiBjbGFzcz0icGlsbCBvayI+JytJLmJvbHQrJ+WFheeUteS4rTwvc3Bhbj4nOic8c3BhbiBjbGFzcz0icGlsbCBncmF5Ij4nK2VzYyh2LmNoYXJnZVN0YXRlfHwi5pyq5YWF55S1IikrJzwvc3Bhbj4nKSsKICAocHcudGV4dD8nPHNwYW4gY2xhc3M9InBpbGwgJysocHcuY2xzPT09Im9uIj8ib2siOiJncmF5IikrJyI+Jytwdy50ZXh0Kyc8L3NwYW4+JzoiIikrCiAgJzwvZGl2PjwvZGl2PjwvZGl2Pic7CiAgY29uc3Qgc3RhdHVzZXM9W107CiAgaWYobGsudGV4dClzdGF0dXNlcy5wdXNoKCc8c3BhbiBjbGFzcz0idnN0YXQgJysobGsuY2xzPT09ImxvY2tlZCI/ImxvY2tlZCI6InVubG9ja2VkIikrJyI+JysobGsuY2xzPT09ImxvY2tlZCI/SS5sb2NrOkkudW5sb2NrKSsnICcrZXNjKGxrLnRleHQpKyc8L3NwYW4+Jyk7CiAgaWYoY3Mpc3RhdHVzZXMucHVzaCgnPHNwYW4gY2xhc3M9InZzdGF0IHNlYXQiPicrSS5zZWF0KycgJytlc2MoY3MpKyc8L3NwYW4+Jyk7CiAgaWYoc3RhdHVzZXMubGVuZ3RoKWgrPSc8ZGl2IGNsYXNzPSJ2c3RhdC1yb3ciPicrc3RhdHVzZXMuam9pbigiIikrJzwvZGl2Pic7CiAgaWYoaXNDaGFyZ2luZyloKz0nPGRpdiBjbGFzcz0iY2hhcmdlLWJhbm5lciI+JytJLmJvbHQrJzxzcGFuIGNsYXNzPSJjdCI+5YWF55S15LitICcrdi5iYXR0ZXJ5UGVyY2VudCsnJTwvc3Bhbj4nKyh2LmJhdHRlcnlQZXJjZW50Pj0xMDA/JzxzcGFuIGNsYXNzPSJjZSI+5bey5YWF5ruhPC9zcGFuPic6KGNoYXJnZUV0YT8nPHNwYW4gY2xhc3M9ImNlIj4nK2NoYXJnZUV0YSsnPC9zcGFuPic6IiIpKSsnPC9kaXY+JzsKICBoKz0nPGRpdiBjbGFzcz0idmtwaS1ncmlkIj4nKwogICc8ZGl2IGNsYXNzPSJ2a3BpIj48ZGl2IGNsYXNzPSJ2IG51bSIgc3R5bGU9ImNvbG9yOicrc29jQ29sKyciPicrKHYuYmF0dGVyeVBlcmNlbnR8fDApKyclPC9kaXY+PGRpdiBjbGFzcz0ibCI+55S16YePIFNPQzwvZGl2PjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9InZrcGkiPjxkaXYgY2xhc3M9InYgbnVtIj4nKyh2LnJhbmdlRXN0aW1hdGVkPyLnuqYiK3YucmVzaWR1YWxSYW5nZUttOnYucmVzaWR1YWxSYW5nZUttfHwwKSsnPC9kaXY+PGRpdiBjbGFzcz0ibCI+57ut6IiqIGttPC9kaXY+PC9kaXY+JysKICAnPGRpdiBjbGFzcz0idmtwaSI+PGRpdiBjbGFzcz0idiBudW0iPicrKHYudG9kYXlEaXN0YW5jZT92LnRvZGF5RGlzdGFuY2UudG9GaXhlZCgxKToiMCIpKyc8L2Rpdj48ZGl2IGNsYXNzPSJsIj7ku4rml6Uga208L2Rpdj48L2Rpdj4nKwogICc8ZGl2IGNsYXNzPSJ2a3BpIj48ZGl2IGNsYXNzPSJ2IG51bSI+Jysodi50b2RheUR1cmF0aW9ufHwwKSsnPC9kaXY+PGRpdiBjbGFzcz0ibCI+6aqR6KGMIG1pbjwvZGl2PjwvZGl2PicrCiAgJzwvZGl2Pic7CiAgaCs9JzxkaXYgY2xhc3M9ImJhdHQtdHJhY2siPjxkaXYgY2xhc3M9ImJhdHQtZmlsbCIgc3R5bGU9IndpZHRoOicrTWF0aC5tYXgoMCxNYXRoLm1pbigxMDAsdi5iYXR0ZXJ5UGVyY2VudHx8MCkpKyclO2JhY2tncm91bmQ6Jytzb2NDb2wrJztjb2xvcjonK3NvY0NvbCsnIj48L2Rpdj48L2Rpdj4nOwogIGNvbnN0IG1ldGFzPVtdOwogIGlmKHYuZnJvbnRQcmVzc3VyZSYmdi5mcm9udFByZXNzdXJlIT09Iuacque7keWumiIpbWV0YXMucHVzaCgnPGRpdiBjbGFzcz0ibWV0YS1pdGVtIj4nK0kudGlyZSsn5YmNIDxiPicrZXNjKHYuZnJvbnRQcmVzc3VyZSkrJzwvYj4nKyh2LmZyb250VGVtcD8nIDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1icmFuZCkiPicrZXNjKHYuZnJvbnRUZW1wKSsnPC9zcGFuPic6IiIpKyc8L2Rpdj4nKTsKICBpZih2LnJlYXJQcmVzc3VyZSYmdi5yZWFyUHJlc3N1cmUhPT0i5pyq57uR5a6aIiltZXRhcy5wdXNoKCc8ZGl2IGNsYXNzPSJtZXRhLWl0ZW0iPicrSS50aXJlKyflkI4gPGI+Jytlc2Modi5yZWFyUHJlc3N1cmUpKyc8L2I+Jysodi5yZWFyVGVtcD8nIDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1icmFuZCkiPicrZXNjKHYucmVhclRlbXApKyc8L3NwYW4+JzoiIikrJzwvZGl2PicpOwogIGlmKHYudm9sdGFnZSltZXRhcy5wdXNoKCc8ZGl2IGNsYXNzPSJtZXRhLWl0ZW0iPicrSS5ib2x0Kyc8Yj4nK3Yudm9sdGFnZS50b0ZpeGVkKDEpKydWPC9iPjwvZGl2PicpOwogIGlmKGlzQ2hhcmdpbmcmJnYuY3VycmVudCltZXRhcy5wdXNoKCc8ZGl2IGNsYXNzPSJtZXRhLWl0ZW0iPicrSS5wbHVnKyc8Yj4nK3YuY3VycmVudC50b0ZpeGVkKDEpKydBPC9iPjwvZGl2PicpOwogIGlmKHYuYmF0dGVyeVRlbXApbWV0YXMucHVzaCgnPGRpdiBjbGFzcz0ibWV0YS1pdGVtIj4nK0kudGhlcm1vKyc8Yj4nK3YuYmF0dGVyeVRlbXAudG9GaXhlZCgwKSsnwrBDPC9iPjwvZGl2PicpOwogIGlmKHYuc2VydmljZUVuZERhdGUpbWV0YXMucHVzaCgnPGRpdiBjbGFzcz0ibWV0YS1pdGVtIj4nK0kuY2FsKyc8Yj4nK2VzYyh2LnNlcnZpY2VFbmREYXRlKSsnPC9iPjwvZGl2PicpOwogIGlmKG1ldGFzLmxlbmd0aCloKz0nPGRpdiBjbGFzcz0ibWV0YS1yb3ciPicrbWV0YXMuam9pbigiIikrJzwvZGl2Pic7CiAgaWYodi5hZGRyZXNzfHxjb29yZE9rKWgrPSc8ZGl2IGNsYXNzPSJ2ZWhpY2xlLWFkZHIiPicrSS5waW4rJzxzcGFuIGNsYXNzPSJhdCI+Jytlc2Modi5hZGRyZXNzfHwi5bey6I635Y+WIEdQUyDlrprkvY0iKSsodi5sb2NhdGlvblRpbWU/JyDCtyAnK2VzYyh2LmxvY2F0aW9uVGltZSk6IiIpKyc8L3NwYW4+PGJ1dHRvbiBjbGFzcz0ibWFwLWJ0biIgJysoY29vcmRPaz8nb25jbGljaz0iZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7b3Blbk1hcCgnK2lkeCsnKSInOidkaXNhYmxlZCB0aXRsZT0i5pqC5peg5pyJ5pWIR1BT5Z2Q5qCHIicpKyc+JytJLm1hcCsn5Zyw5Zu+PC9idXR0b24+PC9kaXY+JzsKICBoKz0nPC9kaXY+JzsKICByZXR1cm4gaDsKfQoKLyogPT09PT09PT09PT09PT09PT0g6L2m6L6G6K+m5oOFICYg5Zyw5Zu+ID09PT09PT09PT09PT09PT09ICovCmZ1bmN0aW9uIG9wZW5NYXAoaWR4KXtjb25zdCB2PVNUQVRFLmRhdGFbaWR4XSYmU1RBVEUuZGF0YVtpZHhdLnZlaGljbGU7aWYoIXYpcmV0dXJuO2lmKCFoYXNWYWxpZENvb3JkKHYubGF0aXR1ZGUsdi5sb25naXR1ZGUpKXt0b2FzdCgi5pqC5peg5pyJ5pWIIEdQUyDlnZDmoIciLCJlcnIiKTtyZXR1cm59Y29uc3QgdXJsPSJodHRwczovL21hcHMuYXBwbGUuY29tLz9xPSIrTnVtYmVyKHYubGF0aXR1ZGUpKyIsIitOdW1iZXIodi5sb25naXR1ZGUpKyImej0xNyI7d2luZG93Lm9wZW4odXJsLCJfYmxhbmsiKX0KZnVuY3Rpb24gdG9nZ2xlVmluKGlkeCl7Y29uc3Qgdj1TVEFURS5kYXRhW2lkeF0mJlNUQVRFLmRhdGFbaWR4XS52ZWhpY2xlO2lmKCF2fHwhdi52aW5ObylyZXR1cm47Y29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInZpblR4dF8iK2lkeCksYnRuPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJ2aW5CdG5fIitpZHgpO2lmKCFlbHx8IWJ0bilyZXR1cm47aWYoZWwudGV4dENvbnRlbnQuaW5kZXhPZigiKiIpPj0wKXtlbC50ZXh0Q29udGVudD12LnZpbk5vO2J0bi50ZXh0Q29udGVudD0i6ZqQ6JePIn1lbHNle2VsLnRleHRDb250ZW50PW1hc2tWaW4odi52aW5Obyk7YnRuLnRleHRDb250ZW50PSLmmL7npLoifX0KZnVuY3Rpb24gc2hvd1ZlaGljbGVEZXRhaWwoaWR4KXsKICBjb25zdCBhPVNUQVRFLmRhdGFbaWR4XTtpZighYSlyZXR1cm47Y29uc3Qgdj1hLnZlaGljbGV8fHt9OwogIGNvbnN0IHB3PXBvd2VyVGV4dCh2LnBvd2VyU3RhdHVzLHYubG9ja1N0YXRlKTsKICBjb25zdCByb3dzPVtdOwogIGlmKHYudmluTm8pcm93cy5wdXNoKFsn6L2m5p625Y+3JywnPHNwYW4gY2xhc3M9InYgbW9ubyIgaWQ9InZpbkR0bCI+Jytlc2MobWFza1Zpbih2LnZpbk5vKSkrJzwvc3Bhbj4gPGJ1dHRvbiBjbGFzcz0idmluLXNob3ciIG9uY2xpY2s9InRvZ2dsZUR0bFZpbigpIj7mmL7npLo8L2J1dHRvbj4nXSk7CiAgcm93cy5wdXNoKFsn5YWF55S154q25oCBJyxlc2Modi5jaGFyZ2VTdGF0ZXx8IuacquWFheeUtSIpXSk7CiAgcm93cy5wdXNoKFsn55S15rqQ54q25oCBJywnPHNwYW4gc3R5bGU9ImNvbG9yOicrKHB3LmNscz09PSJvbiI/InZhcigtLW9rKSI6InZhcigtLXR4dDIpIikrJyI+Jytwdy50ZXh0Kyc8L3NwYW4+J10pOwogIGlmKHYucmlkZVN0YXRlfHx2Lm9ubGluZSlyb3dzLnB1c2goWyfovabovobnirbmgIEnLGVzYyh2LnJpZGVTdGF0ZXx8di5vbmxpbmUpXSk7CiAgcm93cy5wdXNoKFsn55S16YePIFNPQycsJzxiIHN0eWxlPSJjb2xvcjonKyh2LmJhdHRlcnlQZXJjZW50PD0yMD8idmFyKC0tZXJyKSI6di5iYXR0ZXJ5UGVyY2VudDw9NTA/InZhcigtLXdhcm4pIjoidmFyKC0tYnJhbmQpIikrJyI+Jysodi5iYXR0ZXJ5UGVyY2VudHx8MCkrJyU8L2I+J10pOwogIGlmKHYudm9sdGFnZSlyb3dzLnB1c2goWyfnlLXljosnLHYudm9sdGFnZS50b0ZpeGVkKDEpKyJWIl0pOwogIGlmKHYuY3VycmVudClyb3dzLnB1c2goWyfnlLXmtYEnLHYuY3VycmVudC50b0ZpeGVkKDEpKyJBIl0pOwogIGlmKHYuYmF0dGVyeVRlbXApcm93cy5wdXNoKFsn55S15rGg5rip5bqmJyx2LmJhdHRlcnlUZW1wLnRvRml4ZWQoMCkrIsKwQyJdKTsKICByb3dzLnB1c2goWyfliankvZnnu63oiKonLCh2LnJlc2lkdWFsUmFuZ2VLbXx8MCkrIiBrbSIrKHYucmFuZ2VFc3RpbWF0ZWQ/Iu+8iOS8sOeul++8iSI6IiIpXSk7CiAgcm93cy5wdXNoKFsn5LuK5pel6aqR6KGMJywodi50b2RheURpc3RhbmNlP3YudG9kYXlEaXN0YW5jZS50b0ZpeGVkKDEpOjApKyIga20gLyAiKyh2LnRvZGF5RHVyYXRpb258fDApKyIgbWluIl0pOwogIGlmKCh2LmZyb250UHJlc3N1cmUmJnYuZnJvbnRQcmVzc3VyZSE9PSLmnKrnu5HlrpoiKXx8KHYucmVhclByZXNzdXJlJiZ2LnJlYXJQcmVzc3VyZSE9PSLmnKrnu5HlrpoiKSlyb3dzLnB1c2goWyfog47ljosnLCfliY0gJytlc2Modi5mcm9udFByZXNzdXJlfHwiLSIpKycgLyDlkI4gJytlc2Modi5yZWFyUHJlc3N1cmV8fCItIildKTsKICBpZih2LmFkZHJlc3Mpcm93cy5wdXNoKFsn6L2m6L6G5L2N572uJywnPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMCI+Jytlc2Modi5hZGRyZXNzKSsnPC9zcGFuPiddKTsKICBjb25zdCBkT2s9aGFzVmFsaWRDb29yZCh2LmxhdGl0dWRlLHYubG9uZ2l0dWRlKTsKICBpZihkT2spcm93cy5wdXNoKFsnR1BTIOWdkOaghycsJzxzcGFuIGNsYXNzPSJ2IG1vbm8iPicrTnVtYmVyKHYubGF0aXR1ZGUpLnRvRml4ZWQoNikrIiwgIitOdW1iZXIodi5sb25naXR1ZGUpLnRvRml4ZWQoNikrJzwvc3Bhbj4nXSk7CiAgaWYodi5sb2NhdGlvblRpbWUpcm93cy5wdXNoKFsn5pyA5ZCO5a6a5L2NJywnPHNwYW4gc3R5bGU9ImNvbG9yOnZhcigtLXR4dDMpO2ZvbnQtd2VpZ2h0OjYwMCI+Jytlc2Modi5sb2NhdGlvblRpbWUpKyc8L3NwYW4+J10pOwogIGlmKHYuc2VydmljZUVuZERhdGUpcm93cy5wdXNoKFsn5pyN5Yqh5Yiw5pyfJyxlc2Modi5zZXJ2aWNlRW5kRGF0ZSldKTsKICBTVEFURS52aW5EdGxSYXc9di52aW5Ob3x8IiI7CiAgY29uc3QgaHRtbD1yb3dzLm1hcChyPT4nPGRpdiBjbGFzcz0ic3ItaXRlbSI+PHNwYW4gY2xhc3M9ImsiPicrclswXSsnPC9zcGFuPjxzcGFuIGNsYXNzPSJ2Ij4nK3JbMV0rJzwvc3Bhbj48L2Rpdj4nKS5qb2luKCIiKSsKICAnPGRpdiBjbGFzcz0iYnRuLXJvdyIgc3R5bGU9Im1hcmdpbi10b3A6MTZweCI+PGJ1dHRvbiBjbGFzcz0iYnRuICcrKGRPaz8icHJpbWFyeSI6IiIpKyciICcrKGRPaz8nb25jbGljaz0iY2xvc2VTaGVldCgpO29wZW5NYXAoJytpZHgrJykiJzonZGlzYWJsZWQgdGl0bGU9IuaaguaXoOacieaViEdQU+WdkOaghyInKSsnPicrSS5tYXArJyDlnLDlm77mn6XnnIs8L2J1dHRvbj48L2Rpdj4nOwogIG9wZW5TaGVldCgi6L2m6L6G6K+m5oOFIMK3ICIrZXNjKHYudmVoaWNsZU5hbWV8fCLmnoHmoLjovabovoYiKSxJLmNhcixodG1sKTsKfQpmdW5jdGlvbiB0b2dnbGVEdGxWaW4oKXtjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgidmluRHRsIik7aWYoIWVsKXJldHVybjtpZihlbC50ZXh0Q29udGVudC5pbmRleE9mKCIqIik+PTApe2VsLnRleHRDb250ZW50PVNUQVRFLnZpbkR0bFJhdztkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjc2hlZXRCb2R5IC52aW4tc2hvdycpLnRleHRDb250ZW50PSLpmpDol48ifWVsc2V7ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NoZWV0Qm9keSAudmluLXNob3cnKS50ZXh0Q29udGVudD0i5pi+56S6IjtlbC50ZXh0Q29udGVudD1tYXNrVmluKGVsLnRleHRDb250ZW50KX19Ci8qID09PT09PT09PT09PT09PT09IOetvuWIsOaJp+ihjO+8iOmdouadv+W3suenu+mZpOaJi+WKqOetvuWIsOWFpeWPo++8jOWumuaXtuetvuWIsOeUseiEmuacrCBjcm9uIOi0n+i0o++8iSA9PT09PT09PT09PT09PT09PSAqLwoKLyogPT09PT09PT09PT09PT09PT0g6L2m6L6G5o6n5Yi2ID09PT09PT09PT09PT09PT09ICovCmZ1bmN0aW9uIGN0cmxBY3QoaWR4LGFjdGlvbixidG4pe2lmKGxvY2F0aW9uLnNlYXJjaC5pbmRleE9mKCJkZW1vIik+PTApe3RvYXN0KCLmvJTnpLrmqKHlvI/vvJrku4XpooTop4jnlYzpnaIiLCJpbmZvIik7cmV0dXJufWNvbnN0IGE9U1RBVEUuZGF0YVtpZHhdO2lmKCFhfHwhYS51c2VySWQpe3RvYXN0KCLor6XotKblj7fnvLrlsJHnlKjmiLdJRCIsImVyciIpO3JldHVybn1jb25zdCBuYW1lcz17ZmluZDoi55+t5oyJ5a+76L2m77yI6L2m6L6G6Zeq54Gv77yJIixsb3VkRmluZDoi6bij56yb6Zeq54Gv77yI6auY5aOw5a+76L2m77yJIixjdXNoaW9uOiLmiZPlvIDlnZDlnqvvvIjlnZDlnqvkvJrlvLnotbfvvIkiLHVubG9jazoi5LqR56uv5byA6ZSBIixsb2NrOiLkupHnq6/lhbPplIEifTtjb25zdCBuYW1lPW5hbWVzW2FjdGlvbl18fGFjdGlvbjtjb25maXJtRGlhbG9nKCLnoa7orqTmiafooYwgIituYW1lLCLor6XmjIfku6TkvJrpgJrov4cgNEcg572R57uc55yf5a6e5o6n5Yi25L2g55qE6L2m6L6G77yaIitlc2MoYS51c2VyTmFtZSkrIuOAgiIsJ2RvQ3RybCgnK2lkeCsiLCciK2FjdGlvbisiJykiKX0KYXN5bmMgZnVuY3Rpb24gZG9DdHJsKGlkeCxhY3Rpb24pe2NvbnN0IGE9U1RBVEUuZGF0YVtpZHhdO2lmKCFhKXJldHVybjtjb25zdCBjYXJkPWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIi5hY2MtY2FyZCIpW2lkeF07Y29uc3QgYnRuPWNhcmQ/Y2FyZC5xdWVyeVNlbGVjdG9yKCcuY3RybC1idG5bZGF0YS1hY3Q9IicrYWN0aW9uKyciXScpOm51bGw7Y29uc3Qgb2xkPWJ0bj9idG4uaW5uZXJIVE1MOiIiO2lmKGJ0bil7YnRuLmRpc2FibGVkPXRydWU7YnRuLmNsYXNzTGlzdC5hZGQoImJ1c3kiKTtidG4uaW5uZXJIVE1MPUkuY2xvY2t9dG9hc3QoIuaMh+S7pOS4i+WPkeS4reKApiIsImluZm8iKTtjb25zdCBkPWF3YWl0IEJhY2tlbmQudmVoaWNsZUN0cmwoYS51c2VySWQsYWN0aW9uKTtpZihidG4pe2J0bi5kaXNhYmxlZD1mYWxzZTtidG4uY2xhc3NMaXN0LnJlbW92ZSgiYnVzeSIpO2J0bi5pbm5lckhUTUw9b2xkfWlmKGQmJmQub2spe3RvYXN0KGQubWVzc2FnZXx8IuaMh+S7pOW3suS4i+WPkSIsIm9rIil9ZWxzZXt0b2FzdCgoZCYmZC5tZXNzYWdlKXx8IuaMh+S7pOWksei0pSIsImVyciIpfX0KCi8qID09PT09PT09PT09PT09PT09IOaXpeW/l+mhtSA9PT09PT09PT09PT09PT09PSAqLwpsZXQgbG9nRmlsdGVyPSJhbGwiOwphc3luYyBmdW5jdGlvbiByZW5kZXJMb2dzKCl7CiAgY29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInBhZ2VMb2dzIik7CiAgZWwuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJzZWN0aW9uLXRpdGxlIj4nK0kua3YrJ+i/kOihjOaXpeW/lzwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImxvZy1wYW5lbCI+PGRpdiBjbGFzcz0ibG9nLWhlYWQiPjxoMz4nK0kua3YrJzxzcGFuPuacgOi/kSA1MCDmnaE8L3NwYW4+PC9oMz48ZGl2IGNsYXNzPSJsb2ctZmlsdGVycyI+JysKICBbJzxidXR0b24gY2xhc3M9ImNoaXAgJysobG9nRmlsdGVyPT09ImFsbCI/Im9uIjoiIikrJyIgb25jbGljaz0ic2V0TG9nRmlsdGVyKFwnYWxsXCcpIj7lhajpg6g8L2J1dHRvbj4nLCc8YnV0dG9uIGNsYXNzPSJjaGlwICcrKGxvZ0ZpbHRlcj09PSJzaWduaW4iPyJvbiI6IiIpKyciIG9uY2xpY2s9InNldExvZ0ZpbHRlcihcJ3NpZ25pblwnKSI+562+5YiwPC9idXR0b24+JywnPGJ1dHRvbiBjbGFzcz0iY2hpcCAnKyhsb2dGaWx0ZXI9PT0idmVoaWNsZSI/Im9uIjoiIikrJyIgb25jbGljaz0ic2V0TG9nRmlsdGVyKFwndmVoaWNsZVwnKSI+5o6n6L2mPC9idXR0b24+J10uam9pbigiIikrCiAgJzwvZGl2PjwvZGl2PjxkaXYgY2xhc3M9ImxvZy1saXN0IiBpZD0ibG9nTGlzdCI+PGRpdiBzdHlsZT0icGFkZGluZzo0MHB4O3RleHQtYWxpZ246Y2VudGVyO2NvbG9yOnZhcigtLXR4dDMpIj7liqDovb3kuK3igKY8L2Rpdj48L2Rpdj48L2Rpdj4nKwogICc8ZGl2IGNsYXNzPSJidG4tcm93IiBzdHlsZT0ibWFyZ2luLXRvcDoxNHB4Ij48YnV0dG9uIGNsYXNzPSJidG4gZGFuZ2VyIiBzdHlsZT0iZmxleDoxIiBvbmNsaWNrPSJjbGVhckxvZ3NVSSgpIj7muIXnqbrml6Xlv5c8L2J1dHRvbj48L2Rpdj4nOwogIGNvbnN0IGxvZ3M9bG9jYXRpb24uc2VhcmNoLmluZGV4T2YoImRlbW8iKT49MD9ERU1PX0xPR1M6YXdhaXQgQmFja2VuZC5nZXRMb2dzKCk7cmVuZGVyTG9nTGlzdChsb2dzKTsKfQpmdW5jdGlvbiBzZXRMb2dGaWx0ZXIoZil7bG9nRmlsdGVyPWY7cmVuZGVyTG9ncygpfQpmdW5jdGlvbiByZW5kZXJMb2dMaXN0KGxvZ3Mpe2NvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJsb2dMaXN0Iik7aWYoIWVsKXJldHVybjtjb25zdCBsaXN0PShsb2dzfHxbXSkuZmlsdGVyKGw9Pntjb25zdCB0PWwudHlwZXx8InNpZ25pbiI7aWYobG9nRmlsdGVyPT09ImFsbCIpcmV0dXJuIHRydWU7cmV0dXJuIHQ9PT1sb2dGaWx0ZXJ9KTtpZighbGlzdC5sZW5ndGgpe2VsLmlubmVySFRNTD0nPGRpdiBjbGFzcz0ibG9nLWVtcHR5Ij4nK0kud2FybisnPGJyPuivpeWIhuexu+S4i+aaguaXoOaXpeW/lzwvZGl2Pic7cmV0dXJufWVsLmlubmVySFRNTD1saXN0Lm1hcCgobG9nLGkpPT57Y29uc3QgdD1sb2cudHlwZXx8InNpZ25pbiI7Y29uc3QgdGFnPXQ9PT0idmVoaWNsZSI/JzxzcGFuIGNsYXNzPSJwaWxsIGFtYmVyIj7mjqfovaY8L3NwYW4+JzonPHNwYW4gY2xhc3M9InBpbGwgY3lhbiI+562+5YiwPC9zcGFuPic7bGV0IHJlcztpZih0PT09InZlaGljbGUiKXtyZXM9JzxzcGFuIGNsYXNzPSJsb2ctcmVzICcrKGxvZy5zdWNjZXNzPyIiOiJlcnIiKSsnIj4nKyhsb2cuYWN0aW9uVGV4dHx8Iui9pui+huaOp+WItiIpKycgJysobG9nLnN1Y2Nlc3M/IuaIkOWKnyI6IuWksei0pe+8miIrZXNjKGxvZy5tZXNzYWdlfHxsb2cuZXJyb3J8fCLmnKrnn6UiKSkrJzwvc3Bhbj4nfWVsc2V7cmVzPSc8c3BhbiBjbGFzcz0ibG9nLXJlcyAnKyhsb2cuc3VjY2Vzcz8iIjoiZXJyIikrJyI+JysobG9nLnN1Y2Nlc3M/IuaIkOWKnyArIitsb2cudG90YWxHYWluOiLlpLHotKU6ICIrKGxvZy5lcnJvcnx8IuacquefpSIpKSsnPC9zcGFuPid9Y29uc3Qgc3RlcHM9bG9nLnN0ZXBzPyhsb2cuc3RlcHMubWFwKHM9Pic8ZGl2PjxpPsK3PC9pPicrZXNjKHMpKyc8L2Rpdj4nKS5qb2luKCIiKSk6IiI7cmV0dXJuICc8ZGl2IGNsYXNzPSJsb2ctaXRlbSIgc3R5bGU9ImFuaW1hdGlvbi1kZWxheTonKyhpKjI1KSsnbXMiPjxkaXYgY2xhc3M9ImxvZy10aW1lIj4nK2VzYyhsb2cudGltZXx8IiIpKyc8L2Rpdj48ZGl2IGNsYXNzPSJsb2ctbWFpbiI+Jyt0YWcrJzxzcGFuIGNsYXNzPSJsb2ctdXNlciI+Jytlc2MobG9nLnVzZXJOYW1lfHwiIikrJzwvc3Bhbj4nK3JlcysnPC9kaXY+Jysoc3RlcHM/JzxkaXYgY2xhc3M9ImxvZy1zdGVwcyI+JytzdGVwcysnPC9kaXY+JzoiIikrJzwvZGl2Pid9KS5qb2luKCIiKX0KYXN5bmMgZnVuY3Rpb24gY2xlYXJMb2dzVUkoKXtjb25maXJtRGlhbG9nKCLmuIXnqbrml6Xlv5ciLCLlsIbliKDpmaTlhajpg6jov5DooYzml6Xlv5fvvIzmraTmk43kvZzkuI3lj6/mgaLlpI3jgIIiLCJjbGVhckxvZ3NOb3ciKX0KYXN5bmMgZnVuY3Rpb24gY2xlYXJMb2dzTm93KCl7Y29uc3Qgb2s9YXdhaXQgQmFja2VuZC5jbGVhckxvZ3MoKTtpZihvayl7dG9hc3QoIuaXpeW/l+W3sua4heepuiIsIm9rIik7cmVuZGVyTG9ncygpfWVsc2UgdG9hc3QoIua4heepuuWksei0pSIsImVyciIpfQoKLyogPT09PT09PT09PT09PT09PT0g6K6+572u6aG1ID09PT09PT09PT09PT09PT09ICovCmxldCBjZmdBY2NvdW50cz1bXTsKZnVuY3Rpb24gcmVuZGVyQ2ZnKCl7CiAgaWYoaXNQcm94eU1vZGUoKSYmbG9jYXRpb24uc2VhcmNoLmluZGV4T2YoImRlbW8iKTwwJiYhU1RBVEUucGFuZWxMb2FkZWQpewogICAgY29uc3QgZWwwPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJwYWdlQ2ZnIik7CiAgICBpZihlbDApZWwwLmlubmVySFRNTD0nPGRpdiBjbGFzcz0iY2ZnLXBhbmVsIj48ZGl2IGNsYXNzPSJjZmctaGVhZCI+PGgzPjxzcGFuIGNsYXNzPSJiYXIgZ3JlZW4iPjwvc3Bhbj7otKblj7fnrqHnkIY8L2gzPjwvZGl2PjxkaXYgY2xhc3M9ImNmZy1ib2R5IiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoyNnB4O2NvbG9yOnZhcigtLXR4dDMpO2ZvbnQtc2l6ZToxM3B4Ij7mraPlnKjku47ohJrmnKzlkI7nq6/lkIzmraXotKblj7fkuI7phY3nva7igKY8L2Rpdj48L2Rpdj4nOwogICAgZW5zdXJlUGFuZWxEYXRhKCkudGhlbigoKT0+cmVuZGVyQ2ZnKCkpOwogICAgcmV0dXJuOwogIH0KICBjb25zdCBjZmc9Z2V0Q2ZnKCk7Y2ZnQWNjb3VudHM9KGlzUHJveHlNb2RlKCkmJlNUQVRFLnBhbmVsQWNjb3VudHM/U1RBVEUucGFuZWxBY2NvdW50czpnZXRBY2NvdW50cygpKS5tYXAoYT0+KHt1c2VyTmFtZTphLnVzZXJOYW1lfHwiIix1c2VySWQ6YS51c2VySWR8fCIiLHRva2VuOmEudG9rZW58fCIiLGJhcmtLZXk6YS5iYXJrS2V5fHwiIn0pKTsKICBjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicGFnZUNmZyIpOwogIGNvbnN0IGFjY1Jvd3M9Y2ZnQWNjb3VudHMubWFwKChhLGlkeCk9Pic8ZGl2IGNsYXNzPSJhY2MtZWRpdCIgZGF0YS1pPSInK2lkeCsnIj48ZGl2IGNsYXNzPSJhY2MtZWRpdC1oZWFkIj48c3BhbiBjbGFzcz0iYWNjLWVkaXQtdGl0bGUiPjxzcGFuIGNsYXNzPSJuIj4nK1N0cmluZyhpZHgrMSkrJzwvc3Bhbj7otKblj7cgJytTdHJpbmcoaWR4KzEpKyc8L3NwYW4+PHNwYW4gY2xhc3M9ImFjdHMiPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgaWQ9InVpZEJ0bl8nK2lkeCsnIiBvbmNsaWNrPSJmZXRjaFVzZXJJZFVJKCcraWR4KycpIj7ojrflj5ZJRDwvYnV0dG9uPjxidXR0b24gY2xhc3M9ImJ0biBzbSBkYW5nZXIiIG9uY2xpY2s9ImRlbGV0ZUFjY291bnRVSSgnK2lkeCsnKSI+5Yig6ZmkPC9idXR0b24+PC9zcGFuPjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImZvcm0tZ3JpZCI+PGRpdiBjbGFzcz0iZi1pdGVtIj48bGFiZWw+5pi156ewPC9sYWJlbD48aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImFjY19uYW1lXycraWR4KyciIHZhbHVlPSInK2VzYyhhLnVzZXJOYW1lKSsnIiBwbGFjZWhvbGRlcj0i5aaCIGx1Y2t5Nzk4Ij48L2Rpdj48ZGl2IGNsYXNzPSJmLWl0ZW0iPjxsYWJlbD7nlKjmiLdJRDwvbGFiZWw+PGlucHV0IHR5cGU9InRleHQiIGlkPSJhY2NfdWlkXycraWR4KyciIHZhbHVlPSInK2VzYyhhLnVzZXJJZCkrJyIgcGxhY2Vob2xkZXI9IueVmeepuuWPr+eCueOAjOiOt+WPlklE44CNIiBzdHlsZT0iZm9udC1mYW1pbHk6dWktbW9ub3NwYWNlLE1lbmxvLG1vbm9zcGFjZTtmb250LXNpemU6MTNweCI+PC9kaXY+PC9kaXY+JysKICAnPGRpdiBjbGFzcz0iZi1pdGVtIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij48bGFiZWw+QXV0aG9yaXphdGlvbiBUb2tlbu+8iOeymOi0tOWNs+WPr++8jOiHquWKqOWOu+aOiSBCZWFyZXIg5YmN57yA77yJPC9sYWJlbD48aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImFjY190b2tlbl8nK2lkeCsnIiB2YWx1ZT0iJytlc2MoYS50b2tlbikrJyIgcGxhY2Vob2xkZXI9ImE3NDc3OWM3LeKApiIgc3R5bGU9ImZvbnQtZmFtaWx5OnVpLW1vbm9zcGFjZSxNZW5sbyxtb25vc3BhY2U7Zm9udC1zaXplOjEzcHgiPjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImYtaXRlbSIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+PGxhYmVsPkJhcmsg6YCa55+lIEtlee+8iOmAieWhq++8jOetvuWIsOaIkOWKn+aOqOmAge+8iTwvbGFiZWw+PGlucHV0IHR5cGU9InRleHQiIGlkPSJhY2NfYmFya18nK2lkeCsnIiB2YWx1ZT0iJytlc2MoYS5iYXJrS2V5KSsnIiBwbGFjZWhvbGRlcj0iQmFyayBLZXkg5oiW6Ieq5bu6IGh0dHBzOi8v5Z+f5ZCNL0tleSI+PC9kaXY+PC9kaXY+Jykuam9pbigiIik7CiAgY29uc3QgY29tbT1jZmcuY29tbXVuaXR5OwogIGNvbnN0IHN3PShpZCxsYWJlbCxzdWIsY2hlY2tlZCk9Pic8bGFiZWwgY2xhc3M9InN3aXRjaCI+PGlucHV0IHR5cGU9ImNoZWNrYm94IiBpZD0iJytpZCsnIiAnKyhjaGVja2VkPyJjaGVja2VkIjoiIikrJz48c3BhbiBjbGFzcz0ic3ciPjwvc3Bhbj48c3BhbiBjbGFzcz0ibGJsIj4nK2xhYmVsKyc8L3NwYW4+PHNwYW4gY2xhc3M9InNjIj4nK3N1YisnPC9zcGFuPjwvbGFiZWw+JzsKICBlbC5pbm5lckhUTUw9CiAgJzxkaXYgY2xhc3M9InNlY3Rpb24tdGl0bGUiPicrSS5rZXkrJ+iuvue9rjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImNmZy1wYW5lbCI+PGRpdiBjbGFzcz0iY2ZnLWhlYWQiPjxoMz48c3BhbiBjbGFzcz0iYmFyIHZpbyI+PC9zcGFuPuaVsOaNruacjeWKoTwvaDM+PC9kaXY+PGRpdiBjbGFzcz0iY2ZnLWJvZHkiPicrCiAgJzxkaXYgY2xhc3M9ImYtaXRlbSI+PGxhYmVsPuacjeWKoeWcsOWdgO+8iOeVmeepuiA9IOebtOi/nuaooeW8j++8iTwvbGFiZWw+PGlucHV0IHR5cGU9InRleHQiIGlkPSJjZmdfYmFzZSIgdmFsdWU9IicrZXNjKGNmZy5zZXJ2ZXJCYXNlKSsnIiBwbGFjZWhvbGRlcj0i5aaCIGh0dHA6Ly96ZWVoby5ib3gg5oiWIGh0dHA6Ly8xOTIuMTY4LjEuMTA6ODA4MCIgc3R5bGU9ImZvbnQtZmFtaWx5OnVpLW1vbm9zcGFjZSxNZW5sbyxtb25vc3BhY2U7Zm9udC1zaXplOjEzcHgiPjxkaXYgY2xhc3M9ImhpbnQiPueVmeepuuaXtuW6lOeUqOWcqOa1j+iniOWZqOWGheebtOi/nuaegeaguCBBUEnvvIjkvp3otZbmnI3liqHnq6/mlL7ooYwgQ09SU++8ie+8m+Whq+WFpeWOn+iEmuacrOmdouadv+WcsOWdgO+8iOWmgiBMb29uIOiZmuaLn+Wfn+WQjSA8Y29kZT56ZWVoby5ib3g8L2NvZGU+77yJ5Y2z5YiH5o2i5Li65Luj55CG5qih5byP77yM55Sx5Y6f6ISa5pys6LSf6LSj562+5ZCN5LiO5Y+W5pWw44CCPC9kaXY+PC9kaXY+JysKICAnPGRpdiBjbGFzcz0iZi1pdGVtIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48bGFiZWw+55yL5p2/6Ieq5Yqo5Yi35paw6Ze06ZqU77yI56eS77yMMTV+MzYwMO+8iTwvbGFiZWw+PGlucHV0IHR5cGU9Im51bWJlciIgaWQ9ImNmZ19yZWZyZXNoIiBtaW49IjE1IiBtYXg9IjM2MDAiIHN0ZXA9IjUiIHZhbHVlPSInKyhjZmcuYXV0b1JlZnJlc2hTZWN8fDYwKSsnIj48L2Rpdj4nKwogICc8L2Rpdj48L2Rpdj4nKwogICc8ZGl2IGNsYXNzPSJjZmctcGFuZWwiPjxkaXYgY2xhc3M9ImNmZy1oZWFkIj48aDM+PHNwYW4gY2xhc3M9ImJhciI+PC9zcGFuPuetvuWQjeWvhumSpemFjee9rjwvaDM+PC9kaXY+PGRpdiBjbGFzcz0iY2ZnLWJvZHkiPicrCiAgJzxkaXYgY2xhc3M9ImZvcm0tZ3JpZCI+JysKICAnPGRpdiBjbGFzcz0iZi1pdGVtIj48bGFiZWw+QXBwIOerryBhcHBJZDwvbGFiZWw+PGlucHV0IHR5cGU9InRleHQiIGlkPSJjZmdfYXBwX2lkIiB2YWx1ZT0iJytlc2MoY2ZnLmFwcC5hcHBJZCkrJyIgc3R5bGU9ImZvbnQtZmFtaWx5OnVpLW1vbm9zcGFjZSxNZW5sbyxtb25vc3BhY2U7Zm9udC1zaXplOjEzcHgiPjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImYtaXRlbSI+PGxhYmVsPkFwcCDnq68gYXBwU2VjcmV0PC9sYWJlbD48aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImNmZ19hcHBfc2VjcmV0IiB2YWx1ZT0iJytlc2MoY2ZnLmFwcC5hcHBTZWNyZXQpKyciIHN0eWxlPSJmb250LWZhbWlseTp1aS1tb25vc3BhY2UsTWVubG8sbW9ub3NwYWNlO2ZvbnQtc2l6ZToxMnB4Ij48L2Rpdj4nKwogICc8ZGl2IGNsYXNzPSJmLWl0ZW0iPjxsYWJlbD5INSDnq68gYXBwSWQ8L2xhYmVsPjxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0iY2ZnX2g1X2lkIiB2YWx1ZT0iJytlc2MoY2ZnLmg1LmFwcElkKSsnIiBzdHlsZT0iZm9udC1mYW1pbHk6dWktbW9ub3NwYWNlLE1lbmxvLG1vbm9zcGFjZTtmb250LXNpemU6MTNweCI+PC9kaXY+JysKICAnPGRpdiBjbGFzcz0iZi1pdGVtIj48bGFiZWw+SDUg56uvIGFwcFNlY3JldDwvbGFiZWw+PGlucHV0IHR5cGU9InRleHQiIGlkPSJjZmdfaDVfc2VjcmV0IiB2YWx1ZT0iJytlc2MoY2ZnLmg1LmFwcFNlY3JldCkrJyIgc3R5bGU9ImZvbnQtZmFtaWx5OnVpLW1vbm9zcGFjZSxNZW5sbyxtb25vc3BhY2U7Zm9udC1zaXplOjEycHgiPjwvZGl2PicrCiAgJzwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImYtaXRlbSIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGxhYmVsPuS6keerr+aOp+i9piBBRVMg5a+G6ZKl77yIMzIg5L2N5Y2B5YWt6L+b5Yi277yM5byAL+WFs+mUgeW/heWhq++8iTwvbGFiZWw+PGlucHV0IHR5cGU9InBhc3N3b3JkIiBpZD0iY2ZnX3ZlaGljbGVfa2V5IiB2YWx1ZT0iJytlc2MoY2ZnLnZlaGljbGVBZXNLZXkpKyciIHBsYWNlaG9sZGVyPSLloavlhpnlubbkv53lrZjlkI7miY3og73kvb/nlKjkupHnq6/lvIDplIEv5YWz6ZSBIiBhdXRvY29tcGxldGU9Im9mZiIgc3R5bGU9ImZvbnQtZmFtaWx5OnVpLW1vbm9zcGFjZSxNZW5sbyxtb25vc3BhY2U7Zm9udC1zaXplOjEycHgiPjxkaXYgY2xhc3M9ImhpbnQiPueUqOS6juW8gC/lhbPplIHmiqXmlocgQUVTLTI1Ni1FQ0Ig5Yqg5a+G77yM5Ye65LqO5a6J5YWo6buY6K6k5LiN5YaF572u44CCPC9kaXY+PC9kaXY+JysKICAnPGRpdiBjbGFzcz0iYnRuLXJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHByaW1hcnkiIG9uY2xpY2s9InNhdmVDZmdVSSgpIj7kv53lrZjphY3nva48L2J1dHRvbj48YnV0dG9uIGNsYXNzPSJidG4iIG9uY2xpY2s9InJlc2V0Q2ZnVUkoKSI+5oGi5aSN6buY6K6kPC9idXR0b24+PC9kaXY+JysKICAnPC9kaXY+PC9kaXY+JysKICAnPGRpdiBjbGFzcz0iY2ZnLXBhbmVsIj48ZGl2IGNsYXNzPSJjZmctaGVhZCI+PGgzPjxzcGFuIGNsYXNzPSJiYXIgYW1iZXIiPjwvc3Bhbj7npL7ljLrku7vliqHlvIDlhbM8L2gzPjwvZGl2PjxkaXYgY2xhc3M9ImNmZy1ib2R5Ij48ZGl2IGNsYXNzPSJmb3JtLWdyaWQiIHN0eWxlPSJnYXA6OHB4Ij4nKwogIHN3KCJjb21tX3Bvc3QiLCLlj5HluIPliqjmgIEiLCIrMSDliIYiLGNvbW0uZW5hYmxlUG9zdCE9PWZhbHNlKStzdygiY29tbV9saWtlIiwi54K56LWe5Yqo5oCBIiwiKzEg5YiGIixjb21tLmVuYWJsZUxpa2UhPT1mYWxzZSkrc3coImNvbW1fY29tbWVudCIsIuivhOiuuuWKqOaAgSIsIuS4jeWKoOWIhiIsY29tbS5lbmFibGVDb21tZW50IT09ZmFsc2UpK3N3KCJjb21tX3NoYXJlIiwi5YiG5Lqr5Yqo5oCBIiwiKzEg5YiGIixjb21tLmVuYWJsZVNoYXJlIT09ZmFsc2UpK3N3KCJjb21tX2RlbGV0ZSIsIuaJp+ihjOWQjuWIoOmZpOWKqOaAgSIsIua4heeQhueXlei/uSIsY29tbS5lbmFibGVEZWxldGUhPT1mYWxzZSkrCiAgJzwvZGl2PjxkaXYgY2xhc3M9ImhpbnQiIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPuWFs+mXreWvueW6lOW8gOWFs+WQju+8jOetvuWIsOiEmuacrOWwhui3s+i/h+ivpeS7u+WKoeOAguS/ruaUueWQjueCueWHu+S4iuaWueOAjOS/neWtmOmFjee9ruOAjeeUn+aViOOAgjwvZGl2PjwvZGl2PjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImNmZy1wYW5lbCI+PGRpdiBjbGFzcz0iY2ZnLWhlYWQiPjxoMz48c3BhbiBjbGFzcz0iYmFyIHZpbyI+PC9zcGFuPuaJi+acuuWPt+eZu+W9le+8iOWFjeaKk+WMhe+8iTwvaDM+PC9kaXY+PGRpdiBjbGFzcz0iY2ZnLWJvZHkiPicrCic8ZGl2IGNsYXNzPSJmb3JtLWdyaWQiPicrCic8ZGl2IGNsYXNzPSJmLWl0ZW0iPjxsYWJlbD7miYvmnLrlj7fvvIjmnoHmoLggQXBwIOe7keWumuWPt+egge+8iTwvbGFiZWw+PGlucHV0IHR5cGU9InRlbCIgaWQ9InBsX3Bob25lIiBwbGFjZWhvbGRlcj0iMTEg5L2N5omL5py65Y+3IiBzdHlsZT0iZm9udC1mYW1pbHk6dWktbW9ub3NwYWNlLE1lbmxvLG1vbm9zcGFjZTtmb250LXNpemU6MTNweCI+PC9kaXY+JysKJzxkaXYgY2xhc3M9ImYtaXRlbSI+PGxhYmVsPuefreS/oemqjOivgeeggTwvbGFiZWw+PGlucHV0IHR5cGU9InRleHQiIGlkPSJwbF9jb2RlIiBwbGFjZWhvbGRlcj0iNiDkvY3pqozor4HnoIEiIHN0eWxlPSJmb250LWZhbWlseTp1aS1tb25vc3BhY2UsTWVubG8sbW9ub3NwYWNlO2ZvbnQtc2l6ZToxM3B4Ij48L2Rpdj4nKwonPC9kaXY+JysKJzxkaXYgY2xhc3M9ImJ0bi1yb3ciPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgb25jbGljaz0ic2VuZFNtc0NvZGUoKSIgaWQ9InBsX3NlbmRfYnRuIj7ojrflj5bpqozor4HnoIE8L2J1dHRvbj48YnV0dG9uIGNsYXNzPSJidG4gcHJpbWFyeSIgb25jbGljaz0icGhvbmVMb2dpblVJKCkiIGlkPSJwbF9sb2dpbl9idG4iPueZu+W9leW5tua3u+WKoOi0puWPtzwvYnV0dG9uPjwvZGl2PicrCic8ZGl2IGNsYXNzPSJoaW50IiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij7nlKjmiYvmnLrlj7cgKyDnn63kv6Hpqozor4HnoIHnmbvlvZXvvIzoh6rliqjojrflj5YgVG9rZW4g5LiO55So5oi3SUTlubbliqDlhaXotKblj7fliJfooajvvIzlhajnqIvml6DpnIDmipPljIXjgILnmbvlvZXmiJDlip/lkI7oh6rliqjkv53lrZjlubbliLfmlrDpobXpnaLjgII8L2Rpdj4nKwonPC9kaXY+PC9kaXY+JysKJzxkaXYgY2xhc3M9ImNmZy1wYW5lbCI+PGRpdiBjbGFzcz0iY2ZnLWhlYWQiPjxoMz48c3BhbiBjbGFzcz0iYmFyIGdyZWVuIj48L3NwYW4+6LSm5Y+3566h55CG77yIJytjZmdBY2NvdW50cy5sZW5ndGgrJyDkuKrvvIk8L2gzPjxidXR0b24gY2xhc3M9ImJ0biBzbSBwcmltYXJ5IiBvbmNsaWNrPSJhZGRBY2NvdW50VUkoKSI+KyDmt7vliqDotKblj7c8L2J1dHRvbj48L2Rpdj48ZGl2IGNsYXNzPSJjZmctYm9keSIgaWQ9ImFjY0xpc3QiPicrKGFjY1Jvd3N8fCc8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOjIycHg7Y29sb3I6dmFyKC0tdHh0Myk7Zm9udC1zaXplOjEzcHgiPuaaguaXoOi0puWPt++8jOeCueWHu+OAjOa3u+WKoOi0puWPt+OAjTwvZGl2PicpKyc8L2Rpdj4nKwogICc8ZGl2IGNsYXNzPSJjZmctYm9keSIgc3R5bGU9InBhZGRpbmctdG9wOjAiPjxkaXYgY2xhc3M9ImJ0bi1yb3ciPjxidXR0b24gY2xhc3M9ImJ0biBwcmltYXJ5IiBvbmNsaWNrPSJzYXZlQWNjb3VudHNVSSgpIj7kv53lrZjmnoHmoLjotKblj7c8L2J1dHRvbj48L2Rpdj4nKwogICc8ZGl2IGNsYXNzPSJjZmctbm90ZSI+PGI+5L2/55So6K+05piOPC9iPjxicj7CtyBUb2tlbu+8mueymOi0tOaKk+WMheW+l+WIsOeahCBBdXRob3JpemF0aW9uIOWAvOWNs+WPr++8jOiHquWKqOWOu+aOiSA8Y29kZT5CZWFyZXIgPC9jb2RlPiDliY3nvIDjgII8YnI+wrcg6I635Y+WSUTvvJrloavlhaUgVG9rZW4g5ZCO54K544CM6I635Y+WSUTjgI3vvIzoh6rliqjku44gSDUgYmFzZUluZm8gLyBBcHAgc2V0dGluZyAvIOi9pui+huWIl+ihqOaOpeWPo+ino+aekOeUqOaIt0lE5LiO5pi156ew44CCPGJyPsK3IEJhcmsgS2V577ya6K+l6LSm5Y+3562+5Yiw5oiQ5Yqf5ZCO5o6o6YCB6YCa55+l77yM55WZ56m65LiN5o6o44CCPGJyPsK3IOaOp+i9puaMh+S7pO+8iOWvu+i9pi/puKPnrJsv5Z2Q5Z6rL+W8gOWFs+mUge+8ieS8muecn+WunuaTjeS9nOi9pui+hu+8jOmcgOS6jOasoeehruiupOOAgjwvZGl2PjwvZGl2PjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImNmZy1wYW5lbCI+PGRpdiBjbGFzcz0iY2ZnLWhlYWQiPjxoMz48c3BhbiBjbGFzcz0iYmFyIGFtYmVyIj48L3NwYW4+5aSH5Lu96LSm5Y+36YWN572uPC9oMz48L2Rpdj48ZGl2IGNsYXNzPSJjZmctYm9keSI+JysKICAnPGRpdiBjbGFzcz0iYnRuLXJvdyI+PGJ1dHRvbiBjbGFzcz0iYnRuIHByaW1hcnkiIG9uY2xpY2s9ImV4cG9ydEJhY2t1cFVJKCkiPuS4gOmUruWvvOWHuuWkh+S7vTwvYnV0dG9uPjxidXR0b24gY2xhc3M9ImJ0biIgb25jbGljaz0iY29weUJhY2t1cFVJKCkiPuWkjeWItuWkh+S7vTwvYnV0dG9uPjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImYtaXRlbSIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCI+PGxhYmVsPuWkh+S7veWGheWuue+8iOWMheWQq+WFqOmDqOi0puWPt+S4jumdouadv+mFjee9ru+8jOWPr+WkjeWItuS/neWtmO+8iTwvbGFiZWw+PHRleHRhcmVhIGlkPSJiYWNrdXBBcmVhIiByb3dzPSI0IiByZWFkb25seSBwbGFjZWhvbGRlcj0i54K55Ye744CM5LiA6ZSu5a+85Ye65aSH5Lu944CN55Sf5oiQ4oCmIiBzdHlsZT0id2lkdGg6MTAwJTtwYWRkaW5nOjlweCAxMXB4O2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxMHB4O2JhY2tncm91bmQ6dmFyKC0tYmcpO2NvbG9yOnZhcigtLXR4dCk7Zm9udC1mYW1pbHk6dWktbW9ub3NwYWNlLE1lbmxvLG1vbm9zcGFjZTtmb250LXNpemU6MTFweDtib3gtc2l6aW5nOmJvcmRlci1ib3giPjwvdGV4dGFyZWE+PC9kaXY+JysKICAnPGRpdiBjbGFzcz0iZi1pdGVtIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48bGFiZWw+5oGi5aSN5aSH5Lu977yI57KY6LS05aSH5Lu9IEpTT04g5ZCO54K55oGi5aSN77yM5bCG6KaG55uW546w5pyJ6LSm5Y+35LiO6YWN572u77yJPC9sYWJlbD48dGV4dGFyZWEgaWQ9ImltcG9ydEFyZWEiIHJvd3M9IjQiIHBsYWNlaG9sZGVyPSLnspjotLTlpIfku70gSlNPTuKApiIgc3R5bGU9IndpZHRoOjEwMCU7cGFkZGluZzo5cHggMTFweDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6MTBweDtiYWNrZ3JvdW5kOnZhcigtLWJnKTtjb2xvcjp2YXIoLS10eHQpO2ZvbnQtZmFtaWx5OnVpLW1vbm9zcGFjZSxNZW5sbyxtb25vc3BhY2U7Zm9udC1zaXplOjExcHg7Ym94LXNpemluZzpib3JkZXItYm94Ij48L3RleHRhcmVhPjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImJ0bi1yb3ciPjxidXR0b24gY2xhc3M9ImJ0biBkYW5nZXIiIG9uY2xpY2s9ImltcG9ydEJhY2t1cFVJKCkiPuaBouWkjeWkh+S7vTwvYnV0dG9uPjwvZGl2PicrCiAgJzxkaXYgY2xhc3M9ImhpbnQiIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPuWkh+S7veWMheWQq+WFqOmDqOi0puWPt++8iOaYteensC/nlKjmiLdJRC9Ub2tlbi9CYXJrS2V577yJ5LiO6Z2i5p2/6YWN572u77yI562+5ZCN5a+G6ZKlL+ekvuWMuuS7u+WKoeW8gOWFsy/oh6rliqjliLfmlrDnrYnvvInjgILmjaLmnLrmiJbph43oo4XlkI7nspjotLTljbPlj6/kuIDplK7ov5jljp/vvIzml6DpnIDph43mlrDmipPljIXloavlhpnjgII8L2Rpdj4nKwogICc8L2Rpdj48L2Rpdj4nKwogICc8ZGl2IGNsYXNzPSJmb290Ij7mnoHmoLggWkVFSE8g6Z2i5p2/ICcrQVBQX1ZFUlNJT04rJyDCtyAnKyhpc1Byb3h5TW9kZSgpPyfotKblj7fkuI7lr4bpkqXlrZjlgqjkuo7ohJrmnKzlkI7nq6/vvIjmnKzmnLrmjIHkuYXljJbvvIknOifmlbDmja7lrZjlgqjkuo7mnKzmnLrmtY/op4jlmaggbG9jYWxTdG9yYWdlJykrJzxicj48YSBjbGFzcz0ibGluayIgaHJlZj0iaHR0cHM6Ly9hZmRpYW4uY29tL2EvbHVja3k3OTgiIHRhcmdldD0iX2JsYW5rIiByZWw9Im5vb3BlbmVyIj7niLHlj5HnlLUgwrcgYWZkaWFuLmNvbS9hL2x1Y2t5Nzk4PC9hPjwvZGl2Pic7Cn0KLyogPT09PT09PT09PT09PT09PT0g5omL5py65Y+355m75b2V77yI5YWN5oqT5YyF77yJID09PT09PT09PT09PT09PT09ICovCmFzeW5jIGZ1bmN0aW9uIHNlbmRTbXNDb2RlKCl7CiAgY29uc3QgcGhvbmU9KGVsKCJwbF9waG9uZSIpPy52YWx1ZXx8IiIpLnRyaW0oKTsKICBpZighL14xXGR7MTB9JC8udGVzdChwaG9uZSkpe3RvYXN0KCLor7fovpPlhaXmraPnoa7nmoQxMeS9jeaJi+acuuWPtyIsImVyciIpO3JldHVybjt9CiAgY29uc3QgYnRuPWVsKCJwbF9zZW5kX2J0biIpO2J0bi5kaXNhYmxlZD10cnVlO2J0bi50ZXh0Q29udGVudD0i5Y+R6YCB5Lit4oCmIjsKICBjb25zdCBkPWF3YWl0IEJhY2tlbmQuc2VuZENvZGUocGhvbmUpOwogIGlmKGQmJmQub2spe3RvYXN0KGQubWVzc2FnZXx8IumqjOivgeeggeW3suWPkemAgSIsIm9rIik7bGV0IHQ9NjA7YnRuLnRleHRDb250ZW50PSLph43mlrDojrflj5YoIit0KyJzKSI7CiAgICBjb25zdCBpdj1zZXRJbnRlcnZhbCgoKT0+e3QtLTtpZih0PD0wKXtjbGVhckludGVydmFsKGl2KTtidG4udGV4dENvbnRlbnQ9IuiOt+WPlumqjOivgeeggSI7YnRuLmRpc2FibGVkPWZhbHNlO31lbHNlIGJ0bi50ZXh0Q29udGVudD0i6YeN5paw6I635Y+WKCIrdCsicykiO30sMTAwMCk7CiAgfWVsc2V7dG9hc3QoKGQmJmQubWVzc2FnZSl8fCLlj5HpgIHlpLHotKXvvIzor7fmo4Dmn6XnvZHnu5wiLCJlcnIiKTtidG4uZGlzYWJsZWQ9ZmFsc2U7YnRuLnRleHRDb250ZW50PSLojrflj5bpqozor4HnoIEiO30KfQphc3luYyBmdW5jdGlvbiBwaG9uZUxvZ2luVUkoKXsKICBjb25zdCBwaG9uZT0oZWwoInBsX3Bob25lIik/LnZhbHVlfHwiIikudHJpbSgpOwogIGNvbnN0IGNvZGU9KGVsKCJwbF9jb2RlIik/LnZhbHVlfHwiIikudHJpbSgpOwogIGlmKCEvXjFcZHsxMH0kLy50ZXN0KHBob25lKSl7dG9hc3QoIuivt+i+k+WFpeato+ehrueahDEx5L2N5omL5py65Y+3IiwiZXJyIik7cmV0dXJuO30KICBpZighY29kZSl7dG9hc3QoIuivt+i+k+WFpeefreS/oemqjOivgeeggSIsImVyciIpO3JldHVybjt9CiAgY29uc3QgYnRuPWVsKCJwbF9sb2dpbl9idG4iKTtidG4uZGlzYWJsZWQ9dHJ1ZTtidG4udGV4dENvbnRlbnQ9IueZu+W9leS4reKApiI7CiAgY29uc3QgZD1hd2FpdCBCYWNrZW5kLnBob25lTG9naW4ocGhvbmUsY29kZSk7CiAgaWYoZCYmZC5vayl7dG9hc3QoZC5tZXNzYWdlfHwi55m75b2V5oiQ5YqfIiwib2siKTtzZXRUaW1lb3V0KCgpPT5sb2NhdGlvbi5yZWxvYWQoKSwxMjAwKTt9CiAgZWxzZXt0b2FzdCgoZCYmZC5tZXNzYWdlKXx8IueZu+W9leWksei0pSIsImVyciIpO30KICBidG4uZGlzYWJsZWQ9ZmFsc2U7YnRuLnRleHRDb250ZW50PSLnmbvlvZXlubbmt7vliqDotKblj7ciOwp9CmZ1bmN0aW9uIGNvbGxlY3RDZmdVSSgpe3JldHVybnthcHA6e2FwcElkOnZhbCgiY2ZnX2FwcF9pZCIpLGFwcFNlY3JldDp2YWwoImNmZ19hcHBfc2VjcmV0Iil9LGg1OnthcHBJZDp2YWwoImNmZ19oNV9pZCIpLGFwcFNlY3JldDp2YWwoImNmZ19oNV9zZWNyZXQiKX0sdmVoaWNsZUFlc0tleTp2YWwoImNmZ192ZWhpY2xlX2tleSIpLnRyaW0oKSxhdXRvUmVmcmVzaFNlYzpub3JtYWxpemVSZWZyZXNoU2VjKHZhbCgiY2ZnX3JlZnJlc2giKSksc2VydmVyQmFzZTp2YWwoImNmZ19iYXNlIikudHJpbSgpLGNvbW11bml0eTp7ZW5hYmxlUG9zdDplbCgiY29tbV9wb3N0IikuY2hlY2tlZCxlbmFibGVMaWtlOmVsKCJjb21tX2xpa2UiKS5jaGVja2VkLGVuYWJsZUNvbW1lbnQ6ZWwoImNvbW1fY29tbWVudCIpLmNoZWNrZWQsZW5hYmxlU2hhcmU6ZWwoImNvbW1fc2hhcmUiKS5jaGVja2VkLGVuYWJsZURlbGV0ZTplbCgiY29tbV9kZWxldGUiKS5jaGVja2VkfX19CmZ1bmN0aW9uIHZhbChpZCl7Y29uc3QgZT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7cmV0dXJuIGU/ZS52YWx1ZToiIn0KZnVuY3Rpb24gZWwoaWQpe3JldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCl9CmFzeW5jIGZ1bmN0aW9uIHNhdmVDZmdVSSgpe2NvbnN0IGM9Y29sbGVjdENmZ1VJKCk7Y29uc3Qgb2s9YXdhaXQgQmFja2VuZC5zYXZlQ29uZmlnKGMpO2lmKG9rKXtpZihpc1Byb3h5TW9kZSgpKXthcHBseVJlbW90ZUNmZyhjKTtTVEFURS5wYW5lbExvYWRlZD1mYWxzZX10b2FzdCgi6YWN572u5bey5L+d5a2YIiwib2siKTtzdGFydEF1dG9SZWZyZXNoKGMuYXV0b1JlZnJlc2hTZWMpO3JlZnJlc2hBbGwodHJ1ZSl9ZWxzZSB0b2FzdCgi5L+d5a2Y5aSx6LSlIiwiZXJyIil9CmZ1bmN0aW9uIHJlc2V0Q2ZnVUkoKXtlbCgiY2ZnX2FwcF9pZCIpLnZhbHVlPURFRkFVTFRfQ0ZHLmFwcC5hcHBJZDtlbCgiY2ZnX2FwcF9zZWNyZXQiKS52YWx1ZT1ERUZBVUxUX0NGRy5hcHAuYXBwU2VjcmV0O2VsKCJjZmdfaDVfaWQiKS52YWx1ZT1ERUZBVUxUX0NGRy5oNS5hcHBJZDtlbCgiY2ZnX2g1X3NlY3JldCIpLnZhbHVlPURFRkFVTFRfQ0ZHLmg1LmFwcFNlY3JldDtlbCgiY2ZnX3ZlaGljbGVfa2V5IikudmFsdWU9IiI7ZWwoImNmZ19yZWZyZXNoIikudmFsdWU9NjA7ZWwoImNmZ19iYXNlIikudmFsdWU9IiI7ZWwoImNvbW1fcG9zdCIpLmNoZWNrZWQ9dHJ1ZTtlbCgiY29tbV9saWtlIikuY2hlY2tlZD10cnVlO2VsKCJjb21tX2NvbW1lbnQiKS5jaGVja2VkPXRydWU7ZWwoImNvbW1fc2hhcmUiKS5jaGVja2VkPXRydWU7ZWwoImNvbW1fZGVsZXRlIikuY2hlY2tlZD10cnVlO3RvYXN0KCLlt7LmgaLlpI3pu5jorqTvvIjpnIDngrnlh7vkv53lrZjvvIkiLCJpbmZvIil9CmZ1bmN0aW9uIGFkZEFjY291bnRVSSgpe2NmZ0FjY291bnRzLnB1c2goe3VzZXJOYW1lOiIiLHVzZXJJZDoiIix0b2tlbjoiIixiYXJrS2V5OiIifSk7Y29uc3QgbGlzdD1lbCgiYWNjTGlzdCIpO2NvbnN0IGlkeD1jZmdBY2NvdW50cy5sZW5ndGgtMTtjb25zdCBodG1sPSc8ZGl2IGNsYXNzPSJhY2MtZWRpdCIgZGF0YS1pPSInK2lkeCsnIj48ZGl2IGNsYXNzPSJhY2MtZWRpdC1oZWFkIj48c3BhbiBjbGFzcz0iYWNjLWVkaXQtdGl0bGUiPjxzcGFuIGNsYXNzPSJuIj4nK1N0cmluZyhpZHgrMSkrJzwvc3Bhbj7otKblj7cgJytTdHJpbmcoaWR4KzEpKyfvvIjmlrDvvIk8L3NwYW4+PHNwYW4gY2xhc3M9ImFjdHMiPjxidXR0b24gY2xhc3M9ImJ0biBzbSIgaWQ9InVpZEJ0bl8nK2lkeCsnIiBvbmNsaWNrPSJmZXRjaFVzZXJJZFVJKCcraWR4KycpIj7ojrflj5ZJRDwvYnV0dG9uPjxidXR0b24gY2xhc3M9ImJ0biBzbSBkYW5nZXIiIG9uY2xpY2s9ImRlbGV0ZUFjY291bnRVSSgnK2lkeCsnKSI+5Yig6ZmkPC9idXR0b24+PC9zcGFuPjwvZGl2PjxkaXYgY2xhc3M9ImZvcm0tZ3JpZCI+PGRpdiBjbGFzcz0iZi1pdGVtIj48bGFiZWw+5pi156ewPC9sYWJlbD48aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImFjY19uYW1lXycraWR4KyciIHBsYWNlaG9sZGVyPSLlpoIgbHVja3k3OTgiPjwvZGl2PjxkaXYgY2xhc3M9ImYtaXRlbSI+PGxhYmVsPueUqOaIt0lEPC9sYWJlbD48aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImFjY191aWRfJytpZHgrJyIgcGxhY2Vob2xkZXI9IueVmeepuuWPr+eCueOAjOiOt+WPlklE44CNIj48L2Rpdj48L2Rpdj48ZGl2IGNsYXNzPSJmLWl0ZW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxsYWJlbD5BdXRob3JpemF0aW9uIFRva2VuPC9sYWJlbD48aW5wdXQgdHlwZT0idGV4dCIgaWQ9ImFjY190b2tlbl8nK2lkeCsnIiBwbGFjZWhvbGRlcj0iYTc0Nzc5Yzct4oCmIj48L2Rpdj48ZGl2IGNsYXNzPSJmLWl0ZW0iIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPjxsYWJlbD5CYXJrIOmAmuefpSBLZXnvvIjpgInloavvvIk8L2xhYmVsPjxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0iYWNjX2JhcmtfJytpZHgrJyIgcGxhY2Vob2xkZXI9IkJhcmsgS2V5IOaIluiHquW7uiBodHRwczovL+Wfn+WQjS9LZXkiPjwvZGl2PjwvZGl2Pic7aWYobGlzdC5xdWVyeVNlbGVjdG9yKCIuYWNjLWVkaXQiKXx8bGlzdC5xdWVyeVNlbGVjdG9yKCJbc3R5bGUqPSd0ZXh0LWFsaWduJ10iKSl7bGlzdC5pbnNlcnRBZGphY2VudEhUTUwoImJlZm9yZWVuZCIsaHRtbCl9ZWxzZXtsaXN0LmlubmVySFRNTD1odG1sfX0KZnVuY3Rpb24gZGVsZXRlQWNjb3VudFVJKGlkeCl7Y29uc3Qgcm93PWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5hY2MtZWRpdFtkYXRhLWk9IicraWR4KyciXScpO2lmKHJvdyl7cm93LnJlbW92ZSgpO2NmZ0FjY291bnRzLnNwbGljZShpZHgsMSk7dG9hc3QoIuW3suWIoOmZpO+8iOmcgOeCueWHu+S/neWtmO+8iSIsImluZm8iKX19CmZ1bmN0aW9uIGNvbGxlY3RBY2NvdW50c1VJKCl7Y29uc3Qgcm93cz1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCIjYWNjTGlzdCAuYWNjLWVkaXQiKTtjb25zdCBsaXN0PVtdO3Jvd3MuZm9yRWFjaChyb3c9Pntjb25zdCBpPXJvdy5nZXRBdHRyaWJ1dGUoImRhdGEtaSIpO2NvbnN0IHRva2VuPWVsKCJhY2NfdG9rZW5fIitpKT8udmFsdWV8fCIiO2lmKHRva2VuLnRyaW0oKSl7bGlzdC5wdXNoKHt1c2VyTmFtZTplbCgiYWNjX25hbWVfIitpKT8udmFsdWV8fCIiLHVzZXJJZDplbCgiYWNjX3VpZF8iK2kpPy52YWx1ZXx8IiIsdG9rZW46Y2xlYW5Ub2tlbih0b2tlbiksYmFya0tleTpjbGVhbkJhcmtLZXkoZWwoImFjY19iYXJrXyIraSk/LnZhbHVlfHwiIil9KX19KTtyZXR1cm4gbGlzdH0KYXN5bmMgZnVuY3Rpb24gc2F2ZUFjY291bnRzVUkoKXtjb25zdCBsaXN0PWNvbGxlY3RBY2NvdW50c1VJKCkubWFwKGE9Pih7dXNlck5hbWU6KGEudXNlck5hbWV8fCIiKS50cmltKCksdXNlcklkOihhLnVzZXJJZHx8IiIpLnRyaW0oKSx0b2tlbjpjbGVhblRva2VuKGEudG9rZW4pLGJhcmtLZXk6Y2xlYW5CYXJrS2V5KGEuYmFya0tleSl9KSk7Y29uc3Qgb2s9YXdhaXQgQmFja2VuZC5zYXZlQWNjb3VudHMobGlzdCk7aWYob2spe2lmKGlzUHJveHlNb2RlKCkpU1RBVEUucGFuZWxBY2NvdW50cz1saXN0O3RvYXN0KCLmnoHmoLjotKblj7flt7Lkv53lrZgiLCJvayIpO3JlZnJlc2hBbGwodHJ1ZSl9ZWxzZSB0b2FzdCgi5L+d5a2Y5aSx6LSlIiwiZXJyIil9CmFzeW5jIGZ1bmN0aW9uIGZldGNoVXNlcklkVUkoaWR4KXtjb25zdCB0b2tlbj1jbGVhblRva2VuKGVsKCJhY2NfdG9rZW5fIitpZHgpPy52YWx1ZXx8IiIpO2NvbnN0IGJ0bj1lbCgidWlkQnRuXyIraWR4KTtpZighdG9rZW4pe3RvYXN0KCLor7flhYjloavlhpkgVG9rZW4iLCJlcnIiKTtyZXR1cm59YnRuLnRleHRDb250ZW50PSLojrflj5bkuK3igKYiO2J0bi5kaXNhYmxlZD10cnVlO2NvbnN0IGQ9YXdhaXQgQmFja2VuZC5nZXRVc2VyaWQodG9rZW4pO2lmKGQmJmQub2smJmQudXNlcklkKXtpZihlbCgiYWNjX3VpZF8iK2lkeCkpZWwoImFjY191aWRfIitpZHgpLnZhbHVlPWQudXNlcklkO2lmKGQudXNlck5hbWUmJmVsKCJhY2NfbmFtZV8iK2lkeCkmJiFlbCgiYWNjX25hbWVfIitpZHgpLnZhbHVlKWVsKCJhY2NfbmFtZV8iK2lkeCkudmFsdWU9ZC51c2VyTmFtZTt0b2FzdCgi6I635Y+W5oiQ5Yqf77yaIisoZC51c2VyTmFtZXx8ZC51c2VySWQpLCJvayIpfWVsc2V7dG9hc3QoIuiOt+WPluWksei0pe+8miIrKChkJiZkLmVycm9yKXx8IuacquefpemUmeivryIpLCJlcnIiKX1idG4udGV4dENvbnRlbnQ9IuiOt+WPlklEIjtidG4uZGlzYWJsZWQ9ZmFsc2V9CgovKiA9PT09PT09PT09PT09PT09PSDlpIfku70gLyDmgaLlpI0gPT09PT09PT09PT09PT09PT0gKi8KZnVuY3Rpb24gZXhwb3J0QmFja3VwVUkoKXtjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiYmFja3VwQXJlYSIpO2lmKCFlbCl7dG9hc3QoIueVjOmdouacquWwsee7qiIsImVyciIpO3JldHVybn1lbC52YWx1ZT0i55Sf5oiQ5Lit4oCmIjtCYWNrZW5kLmJhY2t1cCgpLnRoZW4oZD0+e2lmKGQmJmQub2spe2VsLnZhbHVlPUpTT04uc3RyaW5naWZ5KGQsbnVsbCwyKTt0b2FzdCgi5aSH5Lu95bey55Sf5oiQ77yM5Y+v5aSN5Yi25L+d5a2YIiwib2siKX1lbHNle2VsLnZhbHVlPSIiO3RvYXN0KCLlr7zlh7rlpLHotKXvvJoiKygoZCYmZC5lcnJvcil8fCLml6Dms5Xov57mjqXohJrmnKzlkI7nq68iKSwiZXJyIil9fSl9CmZ1bmN0aW9uIGNvcHlCYWNrdXBVSSgpe2NvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJiYWNrdXBBcmVhIik7aWYoIWVsfHwhZWwudmFsdWUpe3RvYXN0KCLor7flhYjngrnlh7vjgIzkuIDplK7lr7zlh7rlpIfku73jgI0iLCJlcnIiKTtyZXR1cm59aWYobmF2aWdhdG9yLmNsaXBib2FyZCYmbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQpe25hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGVsLnZhbHVlKS50aGVuKCgpPT50b2FzdCgi5bey5aSN5Yi25Yiw5Ymq6LS05p2/Iiwib2siKSwoKT0+e2VsLnNlbGVjdCgpO2RvY3VtZW50LmV4ZWNDb21tYW5kKCJjb3B5Iik7dG9hc3QoIuW3suWkjeWItuWIsOWJqui0tOadvyIsIm9rIil9KX1lbHNle2VsLnNlbGVjdCgpO2RvY3VtZW50LmV4ZWNDb21tYW5kKCJjb3B5Iik7dG9hc3QoIuW3suWkjeWItuWIsOWJqui0tOadvyIsIm9rIil9fQpmdW5jdGlvbiBpbXBvcnRCYWNrdXBVSSgpe2NvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJpbXBvcnRBcmVhIik7aWYoIWVsfHwhZWwudmFsdWUudHJpbSgpKXt0b2FzdCgi6K+35YWI57KY6LS05aSH5Lu95YaF5a65IiwiZXJyIik7cmV0dXJufWNvbmZpcm1EaWFsb2coIuaBouWkjeWkh+S7vSIsIuWwhuimhuebluW9k+WJjeWFqOmDqOi0puWPt+S4jumdouadv+mFjee9ru+8jOatpOaTjeS9nOS4jeWPr+aSpOmUgOOAgiIsImltcG9ydEJhY2t1cE5vdyIpfQphc3luYyBmdW5jdGlvbiBpbXBvcnRCYWNrdXBOb3coKXtjb25zdCBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiaW1wb3J0QXJlYSIpO2NvbnN0IHY9ZWw/ZWwudmFsdWUudHJpbSgpOiIiO2lmKCF2KXt0b2FzdCgi5aSH5Lu95YaF5a655Li656m6IiwiZXJyIik7cmV0dXJufWNvbnN0IGQ9YXdhaXQgQmFja2VuZC5yZXN0b3JlQmFja3VwKHYpO2lmKGQmJmQub2spe3RvYXN0KCLmgaLlpI3miJDlip/vvJoiKyhkLmNvdW50fHwwKSsiIOS4qui0puWPtyIsIm9rIik7aWYoaXNQcm94eU1vZGUoKSl7U1RBVEUucGFuZWxBY2NvdW50cz1bXTtTVEFURS5wYW5lbExvYWRlZD1mYWxzZX1TVEFURS5kYXRhPVtdO3JlbmRlckNmZygpO3JlZnJlc2hBbGwodHJ1ZSl9ZWxzZSB0b2FzdCgi5oGi5aSN5aSx6LSl77yaIisoKGQmJmQuZXJyb3IpfHwi5aSH5Lu95YaF5a655qC85byP6ZSZ6K+vIiksImVyciIpfQoKLyogPT09PT09PT09PT09PT09PT0g5ryU56S65pWw5o2u77yIP2RlbW8g6aKE6KeI55So77yM5LiN6IGU572R77yJID09PT09PT09PT09PT09PT09ICovCmNvbnN0IERFTU9fREFUQT1bCnt1c2VyTmFtZToi6Zi/5rO9Iix1c2VySWQ6IjIwMjUxMDA5MTIzNDU2NzgiLHNjb3JlOjEyODgwLHNpZ25lZFRvZGF5OnRydWUsY29udGludWVEYXlzOjQyLHRvZGF5U2NvcmU6MTIsc2lnbkNvdW50OjM2LHRva2VuVmFsaWQ6dHJ1ZSxsYXN0Nzpbe2RhdGU6IjA5LTA0IixzaWduZWQ6dHJ1ZSxpc1RvZGF5OmZhbHNlfSx7ZGF0ZToiMDktMDUiLHNpZ25lZDp0cnVlLGlzVG9kYXk6ZmFsc2V9LHtkYXRlOiIwOS0wNiIsc2lnbmVkOnRydWUsaXNUb2RheTpmYWxzZX0se2RhdGU6IjA5LTA3IixzaWduZWQ6dHJ1ZSxpc1RvZGF5OmZhbHNlfSx7ZGF0ZToiMDktMDgiLHNpZ25lZDp0cnVlLGlzVG9kYXk6ZmFsc2V9LHtkYXRlOiIwOS0wOSIsc2lnbmVkOnRydWUsaXNUb2RheTpmYWxzZX0se2RhdGU6IjA5LTEwIixzaWduZWQ6dHJ1ZSxpc1RvZGF5OnRydWV9XSx2ZWhpY2xlOntoYXNWZWhpY2xlOnRydWUsdmVoaWNsZU5hbWU6IlpFRUhPIEFFNCIsdmluTm86IkxCN0pNMUMxME5BMDAwMDAxIixiYXR0ZXJ5UGVyY2VudDo3NixyZXNpZHVhbFJhbmdlS206NjMscmFuZ2VFc3RpbWF0ZWQ6ZmFsc2UsY2hhcmdlU3RhdGU6IuacquWFheeUtSIsdm9sdGFnZTo4NC41LGN1cnJlbnQ6MCxiYXR0ZXJ5VGVtcDoyNixmcm9udFByZXNzdXJlOiIyLjM1YmFyIixyZWFyUHJlc3N1cmU6IjIuNDBiYXIiLGZyb250VGVtcDoiMzHCsEMiLHJlYXJUZW1wOiIzMsKwQyIsdG9kYXlEaXN0YW5jZToxMi42LHRvZGF5RHVyYXRpb246MzQsdG9kYXlNYXhTcGVlZDo1NixsYXN0UmlkZU1pbGVhZ2U6OC4yLG9ubGluZToiMSIscG93ZXJTdGF0dXM6IjAiLGxvY2tTdGF0ZToiMSIsY3VzaGlvblN0YXRlOiIwIixhZGRyZXNzOiLnpo/lu7rnnIHlroHlvrfluILolYnln47ljLrkuJzkvqjlvIDlj5HljLoiLGxvY2F0aW9uVGltZToiMDg6MTIiLGxvbmdpdHVkZToxMTkuNTUwOSxsYXRpdHVkZToyNi42NjU0LHNlcnZpY2VFbmREYXRlOiIyMDI3LTAzLTE4In19LAp7dXNlck5hbWU6IuWwj+a7oSIsdXNlcklkOiIyMDI2MDEwMTExMjIzMzQ0IixzY29yZTo1MjAsc2lnbmVkVG9kYXk6ZmFsc2UsY29udGludWVEYXlzOjMsdG9kYXlTY29yZTowLHNpZ25Db3VudDo5LHRva2VuVmFsaWQ6ZmFsc2UsbGFzdDc6W3tkYXRlOiIwOS0wNCIsc2lnbmVkOnRydWUsaXNUb2RheTpmYWxzZX0se2RhdGU6IjA5LTA1IixzaWduZWQ6ZmFsc2UsaXNUb2RheTpmYWxzZX0se2RhdGU6IjA5LTA2IixzaWduZWQ6ZmFsc2UsaXNUb2RheTpmYWxzZX0se2RhdGU6IjA5LTA3IixzaWduZWQ6dHJ1ZSxpc1RvZGF5OmZhbHNlfSx7ZGF0ZToiMDktMDgiLHNpZ25lZDp0cnVlLGlzVG9kYXk6ZmFsc2V9LHtkYXRlOiIwOS0wOSIsc2lnbmVkOnRydWUsaXNUb2RheTpmYWxzZX0se2RhdGU6IjA5LTEwIixzaWduZWQ6ZmFsc2UsaXNUb2RheTp0cnVlfV0sdmVoaWNsZTp7aGFzVmVoaWNsZTp0cnVlLHZlaGljbGVOYW1lOiLmnoHmoLggQUU2Iix2aW5ObzoiTEI3Sk0xQzEwTkEwMDAwMDIiLGJhdHRlcnlQZXJjZW50OjIzLHJlc2lkdWFsUmFuZ2VLbToyMCxyYW5nZUVzdGltYXRlZDp0cnVlLGNoYXJnZVN0YXRlOiLlhYXnlLXkuK0iLHZvbHRhZ2U6ODYuMixjdXJyZW50OjUuNCxiYXR0ZXJ5VGVtcDozMSxmcm9udFByZXNzdXJlOiIyLjEwYmFyIixyZWFyUHJlc3N1cmU6IiIsZnJvbnRUZW1wOiIiLHJlYXJUZW1wOiIiLHRvZGF5RGlzdGFuY2U6MCx0b2RheUR1cmF0aW9uOjAsdG9kYXlNYXhTcGVlZDowLGxhc3RSaWRlTWlsZWFnZTowLG9ubGluZToiMCIscG93ZXJTdGF0dXM6IjEiLGxvY2tTdGF0ZToiMCIsY3VzaGlvblN0YXRlOiIxIixhZGRyZXNzOiIiLGxvY2F0aW9uVGltZToiIixsb25naXR1ZGU6IiIsbGF0aXR1ZGU6IiIsc2VydmljZUVuZERhdGU6IiJ9fQpdOwpjb25zdCBERU1PX0xPR1M9Wwp7dGltZToiMjAyNi0wOS0xMCAwNzowMDoxMiIsdHlwZToic2lnbmluIix1c2VyTmFtZToi6Zi/5rO9IixzdWNjZXNzOnRydWUsdG90YWxHYWluOjEyLHNpZ25pblNjb3JlOjYsYmxpbmRCb3hTY29yZTo2LGludGVyYWN0U2NvcmU6MCxjb250aW51ZURheXM6NDIsc3RlcHM6WyLnrb7liLDmiJDlip8gKzYiLCLnm7Lnm5LojrflvpcgKzYgKOenr+WIhikiLCLnm7Lnm5LmnKrop6PplIEoMzYvMzApIl19LAp7dGltZToiMjAyNi0wOS0xMCAwNzowMDoxNSIsdHlwZToic2lnbmluIix1c2VyTmFtZToi5bCP5ruhIixzdWNjZXNzOmZhbHNlLGVycm9yOiJUb2tlbuW3sui/h+acnyIsc3RlcHM6WyLnrb7liLDlpLHotKU6IOivt+WFiOeZu+W9lSJdfSwKe3RpbWU6IjIwMjYtMDktMDkgMjI6MzE6MDUiLHR5cGU6InZlaGljbGUiLHVzZXJOYW1lOiLpmL/ms70iLHN1Y2Nlc3M6dHJ1ZSxhY3Rpb25UZXh0OiLkupHnq6/lvIDplIEiLG1lc3NhZ2U6IuS6keerr+W8gOmUgeaMh+S7pOW3suS4i+WPkSIsc3RlcHM6W119Cl07CgovKiA9PT09PT09PT09PT09PT09PSDliLfmlrAgJiDliJ3lp4vljJYgPT09PT09PT09PT09PT09PT0gKi8KbGV0IGxvYWRpbmc9ZmFsc2U7CmFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hBbGwoc2lsZW50KXsKICBpZihsb2FkaW5nKXJldHVybjtsb2FkaW5nPXRydWU7CiAgaWYoIXNpbGVudCl7Y29uc3QgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInBhZ2VIb21lIik7aWYoIVNUQVRFLmRhdGEubGVuZ3RoKWVsLmlubmVySFRNTD1za2VsZXRvbkhvbWUoKX0KICBjb25zdCBkPWF3YWl0IEJhY2tlbmQuZ2V0RGFzaGJvYXJkKCk7CiAgbG9hZGluZz1mYWxzZTsKICBpZihkJiZkLm9rKXtTVEFURS5kYXRhPWQuYWNjb3VudHN8fFtdO1NUQVRFLnRzVGV4dD1mbXRUaW1lKGQudGltZXN0YW1wfHxuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkpO1NUQVRFLnByb3h5PWlzUHJveHlNb2RlKCk7cmVuZGVySG9tZSgpfQogIGVsc2V7Y29uc3QgaGludD1kJiZkLnJhdyYmZC5yYXcuZXJyb3I/bmV0d29ya0hpbnQoZC5yYXcpOiIiO2NvbnN0IGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJwYWdlSG9tZSIpO2VsLmlubmVySFRNTD0nPGRpdiBjbGFzcz0iZW1wdHkiPjxoMz7mlbDmja7liqDovb3lpLHotKU8L2gzPjxwPicrKGhpbnR8fGVzYygoZCYmZC5lcnJvcil8fCLnvZHnu5zlvILluLjvvIzor7fmo4Dmn6XmnI3liqHlnLDlnYDmiJbnvZHnu5zov57mjqUiKSkrJzwvcD48ZGl2IGNsYXNzPSJidG4tcm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OmNlbnRlciI+PGJ1dHRvbiBjbGFzcz0iYnRuIHByaW1hcnkiIG9uY2xpY2s9InJlZnJlc2hBbGwoKSI+6YeN6K+VPC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iYnRuIiBvbmNsaWNrPSJzd2l0Y2hUYWIoXCdjZmdcJykiPuajgOafpeiuvue9rjwvYnV0dG9uPjwvZGl2PjwvZGl2Pid9Cn0KZnVuY3Rpb24gaW5pdCgpewogIGFwcGx5VGhlbWUoKTttb3VudFRoZW1lQnRuKCk7CiAgcmVuZGVyQ2ZnKCk7CiAgaWYobG9jYXRpb24uc2VhcmNoLmluZGV4T2YoImRlbW8iKT49MCl7CiAgICBTVEFURS5kYXRhPURFTU9fREFUQTtTVEFURS50c1RleHQ9Zm10VGltZShuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkpO1NUQVRFLnByb3h5PWZhbHNlOwogICAgcmVuZGVySG9tZSgpO3JldHVybjsKICB9CiAgc3RhcnRBdXRvUmVmcmVzaCgpO3JlZnJlc2hBbGwoZmFsc2UpOwp9CmluaXQoKTsKPC9zY3JpcHQ+CjwhLS1fX0pTNV9fLS0+Cg==";
function __appDecodeUtf8(b64){
  const bin = atob(b64); const out = []; let i = 0;
  while (i < bin.length) {
    const c1 = bin.charCodeAt(i++) & 0xff;
    if (c1 < 0x80) { out.push(String.fromCharCode(c1)); continue; }
    const c2 = bin.charCodeAt(i++) & 0xff;
    if ((c1 & 0xe0) === 0xc0) { out.push(String.fromCharCode(((c1 & 0x1f) << 6) | (c2 & 0x3f))); continue; }
    const c3 = bin.charCodeAt(i++) & 0xff;
    if ((c1 & 0xf0) === 0xe0) { out.push(String.fromCharCode(((c1 & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f))); continue; }
    const c4 = bin.charCodeAt(i++) & 0xff;
    const cp = ((c1 & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
    const u = cp - 0x10000;
    out.push(String.fromCharCode(0xD800 + (u >> 10), 0xDC00 + (u & 0x3ff)));
  }
  return out.join("");
}
function __APP_HTML(){ return __appDecodeUtf8(__APP_HTML_B64); }

!(async () => {
  if (typeof $request === "undefined" || !$request) {
    $.log("极核看板增强版：请通过重写规则访问 http://zeeho.box");
    $done();
    return;
  }

  const url = $request.url || "";
  // 自动识别当前入口域名：Loon=http://zeeho.box，QX=http://www.example.com
  try { const _u = new URL(url); PANEL_HOST = _u.origin; } catch (e) {}
  // 极核API请求由前面的autoCapture处理，主入口跳过，避免$done调用两次
  if (url.includes('zeehoev.com')) {
    console.log('[主入口] 跳过非面板请求: ' + url.substring(0, 80));
    return; // autoCapture会调用$done
  }
  const method = ($request.method || "GET").toUpperCase();
  let path = "/";
  try {
    const u = new URL(url);
    path = u.pathname || "/";
  } catch(e) { path = "/"; }

  // API: 保存配置
  if (method === "POST" && path === "/api/save-config") {
    const body = parseBody($request);
    const ok = saveConfig(body);
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: ok }));
    return;
  }

  // API: 验证用户ID与Token是否匹配
  if (method === "POST" && path === "/api/verify-account") {
    const body = parseBody($request);
    const userId = String(body.userId || "");
    const token = cleanToken(body.token || "");
    const cfg = getConfig();
    let valid = false;
    let message = "";
    let returnedId = "";
    if (!userId || !token) {
      message = "用户ID和Token不能为空";
    } else {
      try {
        const signH = getSign("app", {}, '', cfg);
        const res = await httpGet(`https://tapi.zeehoev.com/v1.0/mine/cfmotoservermine/setting/${userId}`, {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json;charset=UTF-8",
          "interfaceversion": "2",
          "user_id": userId,
          ...signH
        });
        if (res.code == "10000" && res.data) {
          returnedId = String(res.data.id || res.data.userId || "");
          if (returnedId === userId) {
            valid = true;
            message = "验证通过，Token与用户ID匹配";
          } else {
            valid = false;
            message = `Token不匹配！该Token属于用户ID: ${returnedId || "未知"}，不是 ${userId}`;
          }
        } else if (res.code == "40001" || res.code == 401) {
          valid = false;
          message = "Token已过期，请重新获取";
        } else {
          valid = false;
          message = "验证失败: " + (res.message || res.code || "未知错误");
        }
      } catch(e) {
        valid = false;
        message = "验证异常: " + String(e);
      }
    }
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ valid: valid, message: message, returnedId: returnedId }));
    return;
  }

  // API: 根据Token自动获取用户ID
  if (method === "POST" && path === "/api/get-userid") {
    const body = parseBody($request);
    const token = cleanToken(body.token || "");
    const cfg = getConfig();
    let userId = "";
    let userName = "";
    let error = null;
    if (!token) {
      error = "请先输入Token";
    } else {
      const baseHeaders = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json;charset=UTF-8",
        "interfaceversion": "2"
      };
      // 递归搜索对象中的 userId 字段
      const findUserId = (obj, depth = 0) => {
        if (!obj || depth > 5) return "";
        if (typeof obj === "string" || typeof obj === "number") return "";
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (/user.?id|uid|create.?by|owner.?id/i.test(key) && val && typeof val !== "object") {
            const s = String(val);
            if (s.length >= 10 && /^\d+$/.test(s)) return s;
          }
          if (val && typeof val === "object") {
            const found = findUserId(val, depth + 1);
            if (found) return found;
          }
        }
        return "";
      };
      // 方式0（最优先，最可靠）：调用 H5 端 baseInfo 接口，不需要 user_id，从 token 直接获取用户信息
      try {
        const signH0 = getSign("h5", { server_name: "SMART" }, '', cfg);
        const res0 = await httpGet("https://h5.zeehoev.com/cfmotoservermine/baseInfo?server_name=SMART", { ...baseHeaders, ...signH0 });
        if (res0 && String(res0.code) === "10000" && res0.data) {
          userId = String(res0.data.id || "");
          userName = String(res0.data.nickName || "");
        }
      } catch(e) {}
      // 方式1：调用 /setting（不带userId）获取当前用户信息
      if (!userId) {
      try {
        const signH = getSign("app", {}, '', cfg);
        const res = await httpGet("https://tapi.zeehoev.com/v1.0/mine/cfmotoservermine/setting", { ...baseHeaders, ...signH });
        if (res.code == "10000" && res.data) {
          userId = String(res.data.id || res.data.userId || "");
          userName = String(res.data.nickName || "");
        }
        if (!userId && res.data) userId = findUserId(res.data);
      } catch(e) {}
      }
      // 方式2：调用积分接口获取用户信息
      if (!userId) {
        try {
          const signH = getSign("app", {}, '', cfg);
          const res = await httpGet("https://tapi.zeehoev.com/v1.0/mine/cfmotoservermine/integral/adjustByShare", { ...baseHeaders, ...signH });
          if (res && res.data) userId = findUserId(res.data);
        } catch(e) {}
      }
      // 方式3：从 vehicle/list 响应中递归搜索 userId
      if (!userId) {
        try {
          const signH = getSign("app", {}, '', cfg);
          const res = await httpGet("https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicle/list", { ...baseHeaders, ...signH });
          if (res && res.data) userId = findUserId(res.data);
          // 也搜索整个响应
          if (!userId && res) userId = findUserId(res);
        } catch(e) {}
      }
      // 方式4：调用 homeRideInfo（需要先获取车辆VIN）
      if (!userId) {
        try {
          const signH = getSign("app", {}, '', cfg);
          const listRes = await httpGet("https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/vehicle/list", { ...baseHeaders, ...signH });
          let vinNo = "";
          const d = listRes?.data;
          if (Array.isArray(d)) vinNo = d[0]?.vinNo || d[0]?.frameNo || "";
          else if (Array.isArray(d?.list)) vinNo = d.list[0]?.vinNo || "";
          else if (Array.isArray(d?.records)) vinNo = d.records[0]?.vinNo || "";
          if (vinNo) {
            const rideRes = await httpGet(`https://tapi.zeehoev.com/v1.0/app/cfmotoserverapp/homeRideInfo?vinNo=${encodeURIComponent(vinNo)}`, { ...baseHeaders, ...signH });
            if (rideRes && rideRes.data) userId = findUserId(rideRes.data);
          }
        } catch(e) {}
      }
      // 方式5：社区接口（粉丝列表/关注列表/用户信息），这些接口响应中通常包含 userId
      if (!userId) {
        const socialUrls = [
          "https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/fans/list?page=1&pageSize=1",
          "https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/follower/list?page=1&pageSize=1",
          "https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/user/fans?page=1&pageSize=1",
          "https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/my/fans?page=1&pageSize=1",
          "https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/community/fans?page=1&pageSize=1",
          "https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/fans/myFans?page=1&pageSize=1",
          "https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/user/info",
          "https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/my/info",
          "https://tapi.zeehoev.com/v1.0/social/cfmotoserversocial/community/userInfo"
        ];
        for (const url of socialUrls) {
          if (userId) break;
          try {
            const signH = getSign("app", {}, '', cfg);
            const res = await httpGet(url, { ...baseHeaders, ...signH });
            if (res && res.data) {
              userId = findUserId(res.data);
              if (!userId && res) userId = findUserId(res);
              // 尝试从昵称中获取 userName
              if (!userName && res.data) {
                const findName = (obj, depth = 0) => {
                  if (!obj || depth > 4) return "";
                  for (const key of Object.keys(obj)) {
                    if (/nick.?name|user.?name|name/i.test(key) && obj[key] && typeof obj[key] === "string") return obj[key];
                    if (obj[key] && typeof obj[key] === "object") {
                      const n = findName(obj[key], depth + 1);
                      if (n) return n;
                    }
                  }
                  return "";
                };
                userName = findName(res.data);
              }
            }
          } catch(e) {}
        }
      }
      if (!userId) error = "自动获取失败，请手动填写用户ID（或打开极核App-我的页面自动捕获）";
    }
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: !!userId, userId: userId, userName: userName, error: error }));
    return;
  }

  // API: 快速保存（客户端通过 zeeho.box 链接直接保存，GET请求，参数在query里）
  // API: 发送短信验证码（手机号登录，免抓包）
  if (method === "POST" && path === "/api/send-code") {
    const body = parseBody($request);
    const phone = String(body.phone || "").trim();
    if (!/^1\d{10}$/.test(phone)) {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, message: "手机号格式不正确（应为11位）" }));
      return;
    }
    const cfg = getConfig();
    const signH = getSign("h5", {}, '', cfg);
    const res = await httpGet(`https://h5.zeehoev.com/cfmotoservermine/authCode/${encodeURIComponent(phone)}`, {
      "Content-Type": "application/json;charset=UTF-8",
      ...signH
    });
    if (res && String(res.code) === "10000") {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true, message: "验证码已发送，请查收短信" }));
    } else {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, message: "发送失败: " + ((res && (res.message || res.msg)) || "未知错误") }));
    }
    return;
  }

  // API: 手机号 + 短信验证码登录（免抓包），成功后自动写入账号列表
  if (method === "POST" && path === "/api/phone-login") {
    const body = parseBody($request);
    const phone = String(body.phone || "").trim();
    const code = String(body.code || "").trim();
    if (!/^1\d{10}$/.test(phone)) {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, message: "手机号格式不正确（应为11位）" }));
      return;
    }
    if (!code) {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, message: "请填写短信验证码" }));
      return;
    }
    const cfg = getConfig();
    const payload = { phone: phone, authCode: code };
    const signH = h5SignWithBody(payload, cfg);
    const loginRes = await httpPost(
      "https://h5.zeehoev.com/cfmotoservermine/user/loginByPhone",
      { "Content-Type": "application/json;charset=UTF-8", ...signH },
      payload,
      20000
    );
    const tokenInfo = loginRes && loginRes.data && loginRes.data.tokenInfo;
    const accessToken = tokenInfo && String(tokenInfo.access_token || "");
    if (!loginRes || String(loginRes.code) !== "10000" || !accessToken) {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, message: "登录失败: " + ((loginRes && (loginRes.message || loginRes.msg)) || "验证码有误或已过期") }));
      return;
    }
    // 用登录 Token 自动获取用户ID与昵称（H5 baseInfo，与「获取ID」一致）
    let userId = "", userName = "";
    try {
      const signH0 = getSign("h5", { server_name: "SMART" }, '', cfg);
      const infoRes = await httpGet("https://h5.zeehoev.com/cfmotoservermine/baseInfo?server_name=SMART", {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json;charset=UTF-8",
        "interfaceversion": "2",
        ...signH0
      });
      if (infoRes && String(infoRes.code) === "10000" && infoRes.data) {
        userId = String(infoRes.data.id || "");
        userName = String(infoRes.data.nickName || "");
      }
    } catch(e) {}
    // 追加/更新账号：同一 Token 或同一用户ID视为同一账号（刷新Token），否则新增
    const list = getAccounts();
    let replaced = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i] && (String(list[i].token || "") === accessToken || (list[i].userId && userId && String(list[i].userId) === userId))) {
        list[i].token = accessToken;
        if (userId) list[i].userId = userId;
        if (userName) list[i].userName = userName;
        replaced = true;
        break;
      }
    }
    const newAcc = { userName: userName || phone, userId: userId, token: accessToken, barkKey: "", userAgent: "" };
    if (!replaced) list.push(newAcc);
    saveAccounts(list);
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true, message: replaced ? "登录成功，已更新该账号" : "登录成功，已添加账号", account: newAcc }));
    return;
  }

  if (path === "/api/quick-save" || path === "/quick-save") {
    try {
      const u = new URL(url);
      const qName = u.searchParams.get('name') || '';
      const qToken = cleanToken(u.searchParams.get('token') || '');
      if (!qToken) {
        sendResp(200, { "Content-Type": "text/html; charset=utf-8" }, '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2 style="color:#EF4444">保存失败</h2><p>Token为空</p><a href="' + PANEL_HOST + '/config">返回配置</a></body></html>');
        return;
      }
      const cfg = getConfig();
      // 自动获取用户ID
      let qUid = '';
      let qNick = qName;
      let fetchErr = '';
      try {
        const signHeaders = getSign('h5', { server_name: 'SMART' }, '', cfg);
        const res = await httpGet('https://h5.zeehoev.com/cfmotoservermine/baseInfo?server_name=SMART', {
          'Content-Type': 'application/json;charset=UTF-8',
          'Authorization': 'Bearer ' + qToken,
          ...signHeaders
        });
        if (res && String(res.code) === '10000' && res.data) {
          qUid = String(res.data.id || '');
          qNick = res.data.nickName || qName;
        } else {
          fetchErr = res?.message || res?.msg || '获取用户ID失败';
        }
      } catch(e) { fetchErr = String(e); }
      // 获取失败用临时ID
      if (!qUid) qUid = 'temp_' + qToken.substring(0, 8);
      // 保存到账号列表
      let accounts = getAccounts();
      const idx = accounts.findIndex(a => String(a.userId) === String(qUid) || cleanToken(a.token) === qToken);
      const acc = { userName: qNick || ('账号' + (accounts.length + 1)), userId: qUid, token: qToken };
      if (idx >= 0) accounts[idx] = Object.assign({}, accounts[idx], acc);
      else accounts.push(acc);
      saveAccounts(accounts);
      console.log('[快速保存] 账号已保存: ' + acc.userName + ' (' + qUid + ')' + (fetchErr ? ' [获取ID失败: '+fetchErr+']' : ''));
      // 返回成功页面
      const okHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>配置已保存</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#F0F4F8;padding:30px 16px}.card{background:#fff;border-radius:14px;padding:30px 20px;max-width:420px;margin:0 auto;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.06)}.icon{width:60px;height:60px;border-radius:50%;background:#D1FAE5;color:#059669;font-size:30px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}.title{font-size:18px;font-weight:700;margin-bottom:8px}.info{font-size:13px;color:#64748B;line-height:1.8;margin-bottom:20px}.info b{color:#0F172A}.btn{display:inline-block;padding:10px 24px;border-radius:8px;background:#0891B2;color:#fff;text-decoration:none;font-size:14px;font-weight:600;margin:4px}.btn2{background:#fff;color:#475569;border:1px solid #E2E8F0}.warn{font-size:11px;color:#F59E0B;margin-top:10px}</style></head><body><div class="card"><div class="icon">✓</div><div class="title">配置保存成功</div><div class="info">昵称：<b>' + (acc.userName) + '</b><br>用户ID：<b>' + qUid + '</b>' + (fetchErr ? '<div class="warn">⚠️ 自动获取用户ID失败（'+fetchErr+'），已用临时ID保存，可在配置页点「获取ID」重试</div>' : '') + '</div><a href="' + PANEL_HOST + '/" class="btn">查看面板</a> <a href="' + PANEL_HOST + '/config" class="btn btn2">配置页</a></div></body></html>';
      sendResp(200, { "Content-Type": "text/html; charset=utf-8" }, okHtml);
    } catch(e) {
      sendResp(200, { "Content-Type": "text/html; charset=utf-8" }, '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2 style="color:#EF4444">保存异常</h2><p>' + String(e) + '</p></body></html>');
    }
    return;
  }

  // API: 保存账号
  if (method === "POST" && path === "/api/save-accounts") {
    const body = parseBody($request);
    const rawList = Array.isArray(body.accounts) ? body.accounts : [];
    // 存盘前统一剥离 Bearer 前缀，仅保留 Token 本体；其余字段（含每账号 barkKey）原样保留
    const list = rawList.map(function(a) {
      return Object.assign({}, a, {
        token: cleanToken(a.token || ""),
        barkKey: cleanBarkKey(a.barkKey || "")
      });
    });
    const ok = saveAccounts(list);
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: ok, count: list.length }));
    return;
  }


  // API: 获取全部数据（账号+车辆+配置）
  if (method === "GET" && path === "/api/data") {
    const cfg = getConfig();
    const accounts = getAccounts();
    // 并发3路拉取（原串行逐个等待，多账号时明显卡顿）
    const data = await fetchAllAccounts(accounts, cfg, 3);
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({
      accounts: data,
      config: { appId: cfg.app.appId, h5AppId: cfg.h5.appId, community: cfg.community },
      timestamp: new Date().toISOString(),
      total: accounts.length
    }));
    return;
  }

  // API: 多车切换 - 获取指定账号指定车辆数据
  if (method === "GET" && path === "/api/vehicle") {
    try {
      const _u = new URL(url);
      const userId = String(_u.searchParams.get("userId") || "");
      const vin = String(_u.searchParams.get("vin") || "");
      const cfg = getConfig();
      const accounts = getAccounts();
      const acc = accounts.find(a => String(a.userId) === String(userId));
      if (!acc || !vin) {
        sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, error: "参数错误" }));
        return;
      }
      const result = await fetchAccountData(acc, cfg, vin);
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true, result: result }));
    } catch (e) {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, error: String(e) }));
    }
    return;
  }

    // API: 获取完整配置（面板模式设置页回填账号密钥用）
  if (method === "GET" && path === "/api/config") {
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true, config: getConfig() }));
    return;
  }

    // API: 获取完整账号列表（含 Token / Bark Key，设置页回填用）
  if (method === "GET" && path === "/api/accounts") {
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true, accounts: getAccounts() }));
    return;
  }

  // API: 获取运行日志
  if (method === "GET" && path === "/api/get-logs") {
    const logs = getLogs();
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ logs: logs }));
    return;
  }

  // API: 清空运行日志
  if (method === "POST" && path === "/api/clear-logs") {
    const ok = clearLogs();
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: ok }));
    return;
  }

  // API: 手动执行签到
  if (method === "POST" && path === "/api/run-signin") {
    const body = parseBody($request);
    const cfg = getConfig();
    const accounts = getAccounts();
    const results = [];
    const targets = body.all ? accounts : accounts.filter(a => String(a.userId) === String(body.userId));
    for (const acc of targets) {
      const r = await runSigninForAccount(acc, cfg);
      results.push(r);
      // 写入日志
      const _d = new Date();
      const _ds = _d.getFullYear() + "-" + String(_d.getMonth()+1).padStart(2,"0") + "-" + String(_d.getDate()).padStart(2,"0");
      addLog({
        time: _d.toLocaleString("zh-CN", { hour12: false }),
        date: _ds,
        type: "signin",
        userName: r.userName,
        userId: r.userId,
        success: r.success,
        totalGain: r.totalGain,
        signinScore: r.signinScore,
        blindBoxScore: r.blindBoxScore,
        interactScore: r.interactScore,
        continueDays: r.continueDays,
        error: r.error,
        steps: r.steps
      });
      // 每账号独立 Bark：仅签到成功且该账号填了 Bark Key 时推送
      if (r.success && acc.barkKey && String(acc.barkKey).trim()) {
        try {
          const _bt = "极核签到成功 · " + (r.userName || "");
          // 盲盒文本：≥10分显示获得积分，低于10分显示距盲盒剩余天数（避免"盲盒0"）
          const _bScore = r.blindBoxScore || 0;
          const _bDay = (r.continueDays || 0) === 0 ? 0 : (((r.continueDays || 0) - 1) % 30) + 1;
          const _bRemain = 30 - _bDay;
          const _bbTxt = _bScore >= 10 ? "盲盒" + _bScore : "距盲盒" + _bRemain + "天";
          const _bb = "今日获得 " + r.totalGain + " 分（签到" + r.signinScore + " / " + _bbTxt + " / 互动" + r.interactScore + "），连签 " + r.continueDays + " 天";
          await barkPush(acc.barkKey, _bt, _bb);
        } catch(e) {}
      }
    }
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: true, results: results }));
    return;
  }

  // API: 车辆远程控制（find寻车 / loudFind鸣笛闪灯 / cushion开坐垫 / unlock开锁 / lock关锁）
  if (method === "POST" && path === "/api/vehicle-control") {
    const body = parseBody($request);
    const action = String(body.action || "");
    const cfg = getConfig();
    const accounts = getAccounts();
    // 按 userId 定位账号；找不到时兜底取第一个
    let acc = accounts.find(a => String(a.userId) === String(body.userId));
    if (!acc && body.userId) acc = accounts[0];
    if (!acc && accounts.length) acc = accounts[0];
    if (!acc) {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, message: "未找到账号，请先在配置页添加" }));
      return;
    }
    if (!VEHICLE_ACTION_TEXT[action]) {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, message: "非法操作类型" }));
      return;
    }
    // 2026-09-20 修复：支持传入指定 VIN，切换车辆后控车操作对应选中车辆而非默认第一台
    const customVin = String(body.vin || "").trim();
    const r = await vehicleControl(acc, action, cfg, customVin);
    console.log(`[车辆控制] ${acc.userName} ${VEHICLE_ACTION_TEXT[action]} => ${r.ok ? "成功" : "失败:" + r.message}`);
    // 控车操作写入运行日志（type=vehicle，日志页可按“控车”筛选）
    try {
      const _vd = new Date();
      const _vds = _vd.getFullYear() + "-" + String(_vd.getMonth()+1).padStart(2,"0") + "-" + String(_vd.getDate()).padStart(2,"0");
      addLog({
        time: _vd.toLocaleString("zh-CN", { hour12: false }),
        date: _vds,
        type: "vehicle",
        action: action,
        actionText: VEHICLE_ACTION_TEXT[action] || "车辆控制",
        userName: acc.userName || "未知",
        userId: acc.userId,
        success: !!r.ok,
        message: r.message || "",
        error: r.ok ? "" : (r.message || "指令失败")
      });
    } catch(e) {}
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify(r));
    return;
  }

  // API: 一键备份全部账号+面板配置
  if (method === "GET" && path === "/api/backup") {
    const payload = {
      ok: true,
      app: "极核ZEEHO",
      type: "zeeho_backup",
      version: SCRIPT_VERSION,
      time: new Date().toLocaleString("zh-CN", { hour12: false }),
      accounts: getAccounts(),
      config: getConfig()
    };
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify(payload));
    return;
  }

  // API: 导入恢复备份（body.json 为完整备份 JSON 字符串，或 body.data 为备份对象）
  if (method === "POST" && path === "/api/import") {
    const body = parseBody($request);
    let bk = null;
    try {
      bk = typeof body.json === "string" && body.json.trim() ? JSON.parse(body.json) : (body.data || body);
    } catch(e) {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, error: "备份内容不是有效JSON" }));
      return;
    }
    if (!bk || (bk.type !== "zeeho_backup" && !Array.isArray(bk.accounts))) {
      sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: false, error: "备份格式不正确" }));
      return;
    }
    // 恢复账号：统一清洗 Token / BarkKey（与保存账号同一逻辑）
    const list = (Array.isArray(bk.accounts) ? bk.accounts : []).map(a => Object.assign({}, a, {
      token: cleanToken(a.token || ""),
      barkKey: cleanBarkKey(a.barkKey || "")
    }));
    const accOk = saveAccounts(list);
    // 恢复配置：缺失字段沿用当前值
    let cfgOk = true;
    if (bk.config && typeof bk.config === "object") {
      try {
        const cur = getConfig();
        const next = {
          app: { appId: bk.config.app?.appId || cur.app.appId, appSecret: bk.config.app?.appSecret || cur.app.appSecret },
          h5: { appId: bk.config.h5?.appId || cur.h5.appId, appSecret: bk.config.h5?.appSecret || cur.h5.appSecret },
          community: {
            enablePost: bk.config.community?.enablePost !== false,
            enableLike: bk.config.community?.enableLike !== false,
            enableComment: bk.config.community?.enableComment !== false,
            enableShare: bk.config.community?.enableShare !== false,
            enableDelete: bk.config.community?.enableDelete !== false
          },
          vehicleAesKey: String(bk.config.vehicleAesKey || "").trim(),
          autoRefreshSec: normalizeRefreshSec(bk.config.autoRefreshSec)
        };
        cfgOk = saveConfig(next);
      } catch(e) { cfgOk = false; }
    }
    console.log(`[备份恢复] 账号 ${list.length} 个，配置${cfgOk ? "已" : "未"}恢复 (${SCRIPT_VERSION})`);
    sendResp(200, { "Content-Type": "application/json" }, JSON.stringify({ ok: accOk, count: list.length, configOk: cfgOk }));
    return;
  }

  // 配置页
  if (path === "/config") {
    const cfg = getConfig();
    const accounts = getAccounts();
    const html = renderConfig(accounts, cfg);
    sendResp(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }, html);
    return;
  }

  // 看板页（默认）→ 输出整合后的 LITE 轻应用界面（数据走本机 /api/*，前端自动进入面板模式）
  sendResp(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }, '<script>window.__PANEL_MODE__=1<\/script>' + __APP_HTML());
})();;

// ========== Env 类（兼容各代理工具） ==========
function Env(e,t){class s{constructor(e){this.env=e}send(e,t="GET"){e="string"==typeof e?{url:e}:e;let s=this.get;"POST"===t&&(s=this.post);const i=new Promise((t,i)=>{s.call(this,e,(e,s,o)=>{e?i(e):t(s)})});return e.timeout?((e,t=1e3)=>Promise.race([e,new Promise((e,s)=>{setTimeout(()=>{s(new Error("请求超时"))},t)})]))(i,e.timeout):i}get(e){return this.send.call(this.env,e)}post(e){return this.send.call(this.env,e,"POST")}}return new class{constructor(e,t){this.name=e,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,t),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}toObj(e,t=null){try{return JSON.parse(e)}catch{return t}}toStr(e,t=null){try{return JSON.stringify(e)}catch{return t}}getdata(e){let t=this.getval(e);if(/^@/.test(e)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(e),o=s?this.getval(s):"";if(o)try{const e=JSON.parse(o);t=e?this.lodash_get(e,i,""):t}catch(e){t=""}}return t}setdata(e,t){let s=!1;if(/^@/.test(t)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(t),r=this.getval(i),a=i?"null"===r?null:r||"{}":"{}";try{const t=JSON.parse(a);this.lodash_set(t,o,e),s=this.setval(JSON.stringify(t),i)}catch(t){const r={};this.lodash_set(r,o,e),s=this.setval(JSON.stringify(r),i)}}else s=this.setval(e,t);return s}lodash_get(e,t,s){const i=t.replace(/\[(\d+)\]/g,".$1").split(".");let o=e;for(const e of i)if(o=Object(o)[e],void 0===o)return s;return o}lodash_set(e,t,s){return Object(e)!==e||(Array.isArray(t)||(t=t.toString().match(/[^.[\]]+/g)||[]),t.slice(0,-1).reduce((e,s,i)=>Object(e[s])===e[s]?e[s]:e[s]=(Math.abs(t[i+1])|0)===+t[i+1]?[]:{},e)[t[t.length-1]]=s),e}getval(e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(e);case"Quantumult X":return $prefs.valueForKey(e);case"Node.js":return this.data=this.loaddata(),this.data[e];default:return this.data&&this.data[e]||null}}setval(e,t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(e,t);case"Quantumult X":return $prefs.setValueForKey(e,t);case"Node.js":return this.data=this.loaddata(),this.data[t]=e,this.writedata(),!0;default:return this.data&&this.data[t]||null}}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const e=this.path.resolve(this.dataFile),t=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(e),i=!s&&this.fs.existsSync(t);if(!s&&!i)return{};{const i=s?e:t;try{return JSON.parse(this.fs.readFileSync(i))}catch(e){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const e=this.path.resolve(this.dataFile),t=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(e),i=!s&&this.fs.existsSync(t),o=JSON.stringify(this.data);s?this.fs.writeFileSync(e,o):i?this.fs.writeFileSync(t,o):this.fs.writeFileSync(e,o)}}get(e,t=()=>{}){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$httpClient.get(e,(e,s,i)=>{!e&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),t(e,s,i)});break;case"Quantumult X":$task.fetch(e).then(e=>{const{statusCode:s,statusCode:i,headers:o,body:r,bodyBytes:a}=e;t(null,{status:s,statusCode:i,headers:o,body:r,bodyBytes:a},r,a)},e=>t(e&&e.error||"UndefinedError"));break;case"Node.js":let s=require("iconv-lite");this.initGotEnv(e),this.got(e).then(e=>{const{statusCode:i,statusCode:o,headers:r,rawBody:a}=e,n=s.decode(a,this.encoding);t(null,{status:i,statusCode:o,headers:r,rawBody:a,body:n},n)},e=>{const{message:i,response:o}=e;t(i,o,o&&s.decode(o.rawBody,this.encoding))})}}post(e,t=()=>{}){const s=e.method?e.method.toLocaleLowerCase():"post";switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$httpClient[s](e,(e,s,i)=>{!e&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),t(e,s,i)});break;case"Quantumult X":e.method=s,$task.fetch(e).then(e=>{const{statusCode:s,statusCode:i,headers:o,body:r,bodyBytes:a}=e;t(null,{status:s,statusCode:i,headers:o,body:r,bodyBytes:a},r,a)},e=>t(e&&e.error||"UndefinedError"));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(e);const{url:o,...r}=e;this.got[s](o,r).then(e=>{const{statusCode:s,statusCode:o,headers:r,rawBody:a}=e,n=i.decode(a,this.encoding);t(null,{status:s,statusCode:o,headers:r,rawBody:a,body:n},n)},e=>{const{message:s,response:o}=e;t(s,o,o&&i.decode(o.rawBody,this.encoding))})}}queryStr(e){let t="";for(const s in e){let i=e[s];null!=i&&""!==i&&("object"==typeof i&&(i=JSON.stringify(i)),t+=`${s}=${i}&`)}return t=t.substring(0,t.length-1),t}log(...e){e.length>0&&(this.logs=[...this.logs,...e]),console.log(e.map(e=>e??String(e)).join(this.logSeparator))}done(e={}){const t=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${t} 秒`),this.log(),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(e);break;case"Node.js":process.exit(0)}}}(e,t)}