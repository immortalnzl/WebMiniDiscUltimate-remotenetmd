// ==UserScript==
// @name         Web Mindisc Song Recognition Enabler
// @description  This userscript lets you use the Song Recognition functionality of Web Minidisc Pro without ElectronWMD
// @version      0.1.0
// @namespace    http://tampermonkey.net/
// @author       Asivery
// @match        https://testing.minidisc.wiki/b0824780-3c0c-11ed-b994-2c56dc399093/
// @match        https://web.minidisc.wiki/
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// @connect      amp.shazam.com
// ==/UserScript==

(function() {
    'use strict';
    unsafeWindow.native = {
        unrestrictedFetchJSON: (url, parameters = {}) => new Promise((res, rej) => {
            GM.xmlHttpRequest({
                method: parameters.method ?? "GET",
                url,
                data: parameters.body ?? "",
                headers: parameters.headers ?? { "Content-Type": "application/json" },
                onload: response =>
                    res(JSON.parse(response.responseText)),
                onerror: error =>
                    rej(error)
            })
        })};
    console.log("[Userscript]: Attached ElectronWMD's fetch method successfully!");
})();
