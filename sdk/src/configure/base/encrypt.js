import encUtf8 from 'crypto-js/enc-utf8'
import aes from 'crypto-js/aes'
import ecb from 'crypto-js/mode-ecb'
import pako from 'pako'
import base64js from 'base64-js'
import MD5 from "../../lib/common/MD5"
import storage from '../../lib/storage/index'
import { encode } from '../../lib/common/Base64'


// 小程序真机 不支持 stob 方法。所以重写这个方法
var base64hash = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function atob (s) {
    s = s.replace(/\s|=/g, '');
    var cur,
        prev,
        mod,
        i = 0,
        result = [];
    while (i < s.length) {
        cur = base64hash.indexOf(s.charAt(i));
        mod = i % 4;
        switch (mod) {
            case 0:
                //TODO
                break;
            case 1:
                result.push(String.fromCharCode(prev << 2 | cur >> 4));
                break;
            case 2:
                result.push(String.fromCharCode((prev & 0x0f) << 4 | cur >> 2));
                break;
            case 3:
                result.push(String.fromCharCode((prev & 3) << 6 | cur));
                break;
        }
        prev = cur;
        i++;
    }
    return result.join('');
}



// 增加解编码方法，放在加密模块里，反正已经引加密方法了，再多点代码无所谓了。解加密，先base64，后gzib。
function decodeRes (b64Data) {
    var strData = atob(b64Data);
    // Convert binary string to character-number array
    var charData = strData.split('').map(function (x) { return x.charCodeAt(0); });
    // Turn number array into byte-array
    var binData = new Uint8Array(charData);
    // unzip
    var data = pako.inflate(binData);
    // Convert gunzipped byteArray back to ascii string:
    strData = String.fromCharCode.apply(null, new Uint16Array(data));
    return strData;
}


let reqt = ''

function getSpv (lib, appid, lib_version) {
    let policyversion = ''
    let appversion = ''
    let spv = lib + '|' + appid + '|' + lib_version + '|' + policyversion + '|' + appversion
    return encodeURIComponent(encode(spv))
}
function encryptKey (lib, appid, lib_version) {
    reqt = +new Date() + (storage.getLocal("ANSSERVERTIME") ? Number(storage.getLocal("ANSSERVERTIME")) : 0)
    let orgkey = lib + appid + lib_version + reqt
    //MD5+base64+切割为数组
    let base64Str = encode(MD5(new String(orgkey), 32).toUpperCase()).split('')
    let F = lib_version.split('.')
    let F1 = F[F.length - 1]
    let F2 = F[F.length - 2]
    if (!(Number(F2) % 2) == 0) {
        //倒叙
        base64Str = base64Str.reverse();
    } else {
        base64Str = base64Str
    }
    let key = ''
    for (let i = 0; i < base64Str.length; i++) {
        //偶数位
        if (i % 2 == 0 && !(Number(F1) % 2 == 0)) {
            key += base64Str[i]
        } else if (!(i % 2 == 0) && Number(F1) % 2 == 0) {
            key += base64Str[i]
        }
    }
    if (key.length < 16) {
        key += key.split('').reverse().join('')
    }
    return key.slice(0, 16)
}
function getEncryptData (data, lib, appid, lib_version, encryptType) {
    let key = encryptKey(lib, appid, lib_version)
    key = encUtf8.parse(key);
    let encryptData = ''
    if (encryptType === 1) {
        encryptData = aes.encrypt(data, key, { mode: ecb })
    }
    if (encryptType === 2) {
        var iv = encUtf8.parse('Analysys_315$CBC');
        encryptData = aes.encrypt(data, key, { iv: iv });
    }
    encryptData = encryptData.ciphertext.toString().toUpperCase()
    let pakoZip = pako.gzip(encryptData)
    return base64js.fromByteArray(pakoZip);
}
function uploadData (option) {
    if (option.encryptType != 1 && option.encryptType != 2) {
        return option;
    };
    let dataArray = option.data;
    let lib = dataArray[0].xcontext.$lib
    let appid = dataArray[0].appid
    let lib_version = dataArray[0].xcontext.$lib_version
    let encryptKey = option.encryptType;
    option.data = getEncryptData(JSON.stringify(dataArray), lib, appid, lib_version, encryptKey);
    option.url += '&spv=' + getSpv(lib, appid, lib_version) + '&reqt=' + reqt + '&reqv=' + option.encryptType;
    return option
}

let encrypt = {
    decodeRes,
    uploadData
}

export default encrypt;