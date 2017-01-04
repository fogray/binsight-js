var InsApmBi = {
    appId: '',
    postUrl: 'http://tag.xinshangmeng.com/v2',
    
    addListener: function(obj, type, fn) {
        if (obj.addEventListener) {
            obj.addEventListener(type, fn, false);
        } else if (obj.attachEvent) {
            obj.attachEvent( "on" + type, fn );
        }
    },
    //字符串转换成字节数
    str2Byte: function(str){
        if (!str) return 0;
        var len = str.length, bytes = 0;
        for (var i = 0; i < len; i++) {
            str.charCodeAt(i)>255 ? bytes += 2 : bytes += 1;
        }
        return bytes;
    },
    //url清除参数
    clearUrlParam: function(url) {
        if (!url) return null;
        var urls = url.split('?');
        var param = urls[1];
        if (param && param.indexOf('method') == 0) {
            var u = urls[0]+'/'+param.split('&')[0].split('=')[1];
            return u.substring(u.length-255);
        } else {
            return urls[0].substring(urls[0].length-255);
        }
    },
    //推送监听数据到监听服务
    post_data: function(url, params){
        var fn = function(){
            APM_SENDER.corsSend(url, params);
        };
        if (window.setImmediate) {
            window.setImmediate(fn);
        } else if (window.msSetImmediate) {
            window.msSetImmediate(fn);
        } else if (window.webkitSetImmediate) {
            window.webkitSetImmediate(fn);
        } else if (window.mozSetImmediate) {
            window.mozSetImmediate(fn);
        } else {
            setTimeout(fn, 10);
        }
    }
};

var APM_SENDER = {
    is_complete: true,
    corsSend: function(url, params) {
    	try{
	        var xhr = new XMLHttpRequest();
	        if (! 'withCredentials' in xhr) {
	            xhr = XDomainRequest();
	        }
	        if (!xhr) return;
	        xhr.open('POST', url, true);
	        if ('setRequestHeader' in xhr) {
		        xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
		    }
	        xhr.send(toParams(params));
	        xhr.onload = function(){
	        	if ('console' in window){
	            	console.log(xhr.responseText);
	        	}
	        };
		}catch(e){
			if ('console' in window) {
				console.log(e);
			}
		}
        function toParams(params) {
            var result = [];
            var k=null;
            for (k in params) {
                if (params.hasOwnProperty(k)) {
                    var type = Object.prototype.toString.call(params[k]);
                    var v = '';
                    if (type === "[object Array]" || type === '[object Object]') {
                        v = (params[k]===undefined || params[k]===null ? "" : encodeURIComponent(JSON.stringify(params[k])));
                    } else {
                        v = (params[k]===undefined || params[k]===null ? "" : encodeURIComponent(params[k]));
                    }
                    result.push(k+'='+v);
                }
            }
            if (result.length > 0) return result.join('&');
            return null;
        }
    },
    sendData: function(url, params) {
        if (!this.is_complete) setTimeout('sendData('+url+','+params+')', 1000);
        this.is_complete = false;
        var form = document.createElement('form');
        form.method = 'POST';
        form.id = "beacon_form";
        
        form.enctype = "application/x-www-form-urlencoded";
        
        var k=null;
        for (k in params) {
            if (params.hasOwnProperty(k)) {
                var input = document.createElement("input");
                input.type = "hidden"; 
                input.name = k;
                var type = Object.prototype.toString.call(params[k]);
                if (type === "[object Array]" || type === '[object Object]') {
                    input.value = (params[k]===undefined || params[k]===null ? "" : encodeURIComponent(JSON.stringify(params[k])));
                } else {
                    input.value = (params[k]===undefined || params[k]===null ? "" : encodeURIComponent(params[k]));
                }
                form.appendChild(input);
            }
        }
        
        function remove(id) {
            var el = document.getElementById(id);
            if (el) {
                el.parentNode.removeChild(el);
            }
        }
        
        function submit() {
            var iframe, name = "insapm_post-" + encodeURIComponent(form.action) + "-" + Math.random();
            
            try {
                iframe = document.createElement('<iframe name="' + name + '">');    // IE <= 8
            } catch (e) {
                iframe = document.createElement("iframe");
            }
            
            form.action = url;
            iframe.name = iframe.id = name;
            
            iframe.style.display = form.style.display = "none";
            iframe.src="javascript:false";
            
            remove(iframe.id);
            remove(form.id);
            
            if (document.body) {
                document.body.appendChild(iframe);
            }
            var iFrmDocument = (iframe.contentWindow || iframe.contentDocument);
            if (iFrmDocument.document) {
                iFrmDocument = iFrmDocument.document;
            }
            if (iFrmDocument.body) {
                iFrmDocument.body.appendChild(form);
            }else {
                iFrmDocument.appendChild(form);
            }
            try {
                form.submit();
            } catch (e) {
            	alert(e);
            }
            
            setTimeout(function() { remove(iframe.id);this.is_complete = true; }, 500);
        }
        
        submit();
    }
};

(function(){
    'use strict';
	if (! 'performance' in window || ! 'timing' in window.performance ) {
		return;
	}
    //传输数据结构体
    var appId = INS_APM && 'info' in INS_APM && 'appId' in INS_APM.info ? INS_APM.info.appId : '';
    if (!appId && appId == '') return;
    //客户端信息
    var clientInfo = getClientInfo();
    //页面信息
    var search = decodeURI(window.location.search);
    var u = window.location.pathname + (search && search.indexOf('?method=') > -1 ? '/'+search.substring(8, (search.indexOf('&') > -1 ? search.indexOf('&') : search.length)): '');
    var pageInfo = {domain: document.domain, pageUrl: u.substring(u.length-255)};
    
    startListen();
    //开始监听
    function startListen(){
        InsApmBi.addListener(document, 'readystatechange', function(){
            if (pageInfo.pageUrl.indexOf('/apm/collector') > -1) return;
            if (document.readyState == 'complete') {
                apmPerformance();
            }
        });
        //ajax异步请求监听
        ajaxListener();
        //error监听
        errorListener();
    }
    
    
    //window.performance网页与程序性能信息
    function apmPerformance(){
        var perf = {};
        var entries = [];
        if ('performance' in window && 'timing' in window.performance) {
            var timing = window.performance.timing;
            //1 请求开始时间
            perf.start = timing.navigationStart;
            //2 总消耗时间
            perf.total = (timing.loadEventEnd == 0 ? timing.domComplete : timing.loadEventEnd) - timing.navigationStart;
            
            //3 重定向时间
            perf.redirect = timing.redirectEnd - timing.redirectStart;
            
            //4 查询缓存时间
            perf.cache = timing.domainLookupStart - timing.fetchStart;
            
            //5 DNS查询时间
            perf.dns = timing.domainLookupEnd - timing.domainLookupStart;
            
            //6 TCP建立连接完成握手的时间
            perf.connect = timing.connectEnd - timing.connectStart;
            
            //7 Web服务端执行时间
            perf.request = timing.responseStart - (timing.secureConnectionStart ? timing.secureConnectionStart : timing.requestStart);
            
            //8 响应数据返回时间
            perf.response = timing.responseEnd == 0 ? 0 : (timing.responseEnd - timing.responseStart);
            
            //9 dom解析时间
            perf.domParse = timing.domInteractive - timing.domLoading;
            
            //10 dom资源加载时间
            perf.domContent = timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart;
            
            //11 dom渲染时间
            perf.domDraw = timing.domComplete - timing.domContentLoadedEventEnd;
            
            //12 执行onload回调函数的时间
            perf.loadEvent = timing.loadEventEnd - timing.loadEventStart;
            
            var navigation = window.performance.navigation;
            perf.redirectCount = navigation.redirectCount;
            perf.loadType = navigation.type;
            
            if ('getEntries' in window.performance) {
                var resArr = window.performance.getEntriesByType('resource');
                if (resArr.length > 1) {
                    //按照加载消耗时间从大到小排序
                    resArr.sort(function(a, b){
//                        var ad = a.responseEnd - a.requestStart;
//                        var bd = b.responseEnd - b.requestStart;
                        return a.duration > b.duration ? -1 : 1;
                    });
                }
                //取加载时间最长的10条静态资源
               resArr = resArr.slice(0, 10);
                for (var i = 0; i < resArr.length; i++) {
                    if (resArr[i].name.indexOf(InsApmBi.postUrl)>-1) {
                        continue;
                    }
                    var name = InsApmBi.clearUrlParam(resArr[i].name);
                    name = name.indexOf('http') == 0 ? name.substring(name.indexOf('//')+2) : name;
                    entries.push({name: name, indicatorType: resArr[i].initiatorType, total: Math.round(resArr[i].duration)});
                }
            }
        }
        
        if (perf && perf.start) {
            var per_url = InsApmBi.postUrl + '/ppf.gif';
            //推送数据
            InsApmBi.post_data(per_url, {appId: appId, clientInfo: clientInfo, page: pageInfo, perf: perf, entries: entries, clientTime: (new Date()).getTime()});
        }
        
    }
    /**
     * 获取浏览器版本
     * scrWidth、scrHeight：分辨率
     * browser_name、browser_version：浏览器名称、版本
     * os_name、os_version：操作系统名称、版本
     */
    function getClientInfo(){
        var ua = window.navigator.userAgent;
        var bro = getBrowser(ua);
        var os = getOs(ua);
        return {scrWidth: window.screen.width, scrHeight: window.screen.height,
                browser_name: bro.browser_name, browser_version: bro.browser_version,
                os_name: os.os_name, os_version: os.os_version};
        function getBrowser(ua){
            var s;
            if ((s=ua.match(/rv:([\d.]+)\) like gecko/i))) {
                return {browser_name: 'MSIE', browser_version: s[1]};
            } else {
                var d = ua.match(/(opera|chrome|safari|firefox|msie)\/?\s*(\d+)/i) || [];
                if (d.length >= 3) {
                    return {browser_name: d[1], browser_version: d[2]};
                } else {
                    return {browser_name: 'Other', browser_version: ''};
                }
            }
        };
        function getOs(ua) {
            var platform = navigator.platform;
            var osName = '';
            var osVer = '';
            if(platform == 'Win32' || platform == 'Win64' || platform == 'Windows') {
                //Windows系统
                osName = 'Windows';
                if (ua.indexOf('Windows NT 5.1') > -1 || ua.indexOf('Windows XP') > -1) {
                    //XP
                    osVer = 'XP';
                } else if (ua.indexOf('Windows NT 5.2') > -1 || ua.indexOf('Windows 2003') > -1) {
                    osVer = '2003';
                } else if (ua.indexOf('Windows NT 6.0') > -1 || ua.indexOf('Windows Vista') > -1) {
                    osVer = 'Vista';
                } else if (ua.indexOf('Windows NT 6.1') > -1 || ua.indexOf('Windows 7') > -1) {
                    osVer = '7';
                } else if (ua.indexOf('Windows NT 6.2') > -1 || ua.indexOf('Windows 8') > -1) {
                    osVer = '8';
                } else if (ua.indexOf('Windows NT 6.3') > -1 || ua.indexOf('Windows 8.1') > -1) {
                    osVer = '8.1';
                } else if (ua.indexOf('Windows NT 10') > -1 || ua.indexOf('Windows 10') > -1) {
                    osVer = '10';
                } else {
                    osVer = 'Other';
                }
            } else if (ua.indexOf('Mac') > -1) {
                osName = 'Mac Os';
            } else if (platform.indexOf('X11') > -1) {
                osName = 'Unix';
            } else if (platform.indexOf('Linux') > -1) {
                osName = 'Linux';
            } else {
                osName = 'Other';
            }
            return {os_name: osName, os_version: osVer};
        }
    }
    
    //xmlhttprequest重写,ajax请求时间消耗
    function ajaxListener() {
        var preXhr = window.XMLHttpRequest;
        window.XMLHttpRequest = function(a){
            var b = new preXhr(a);
            var rnd = (''+Math.random()).replace('.','');
            b['startTime'+rnd] = 0;
            b['endTime'+rnd] = 0;
            b['open_url'] = '';
            if (preXhr.prototype.addEventListener) {
                b.open = function (m, url, flag) {
                    b['open_url'] = url;
                    preXhr.prototype.open.apply(this,arguments);
                };
                b.addEventListener('readystatechange', function(){
                    if (!b['open_url'] || b['open_url']=='' || (b['open_url'] && b['open_url'].indexOf(InsApmBi.postUrl) > -1)) {
                        //数据传输异步请求，不作为监控对象
                        return false;
                    }
                    var state = b.readyState;
                    if (state == 0) {
                        //发送状态，调用了open方法，并准备好把一个请求发送到服务器
                        //timing.startTime = new Date().getTime();
                        b['startTime'+rnd] = new Date().getTime();
                    }
                    if (state == 1) {
                        //发送状态，调用了open方法，并准备好把一个请求发送到服务器
                        //timing.startTime = new Date().getTime();
                        b['startTime'+rnd] = b['startTime'+rnd] == 0 ? new Date().getTime(): b['startTime'+rnd];
                    }
                    if (state == 2) {
                        //已经通过send方法把一个请求发送到服务器端，但是还没有收到一个响应
                        //timing.requestStartTime = new Date().getTime();
                        b['startTime'+rnd] = b['startTime'+rnd] == 0 ? new Date().getTime(): b['startTime'+rnd];
                    }
                    if (state == 3) {
                        //已经接收到HTTP响应头部信息，但是消息体部分还没有完全接收结束
                        //timing.responseStartTime = new Date().getTime();
                        b['startTime'+rnd] = b['startTime'+rnd] == 0 ? new Date().getTime(): b['startTime'+rnd];
                    }
                    if (state == 4){
                        //响应已经被完全接收
                        //timing.responseEndTime = new Date().getTime();
                        b['endTime'+rnd] = new Date().getTime();
                        var respUrl = InsApmBi.clearUrlParam(decodeURI(b['open_url']));
                        var xhrPerf = { respUrl: respUrl, times: b['endTime'+rnd] - b['startTime'+rnd], 
                                        statusCode: b.status, recBytes: InsApmBi.str2Byte(b.responseText)};
                        
                        if (respUrl && respUrl != undefined && respUrl != '') {
                            //包装异步请求传输数据
                            var url = InsApmBi.postUrl + '/xhr.gif';
                            InsApmBi.post_data(url, {appId: appId, clientInfo: clientInfo, page: pageInfo, xhr: xhrPerf, clientTime: (new Date()).getTime()});
                        }
                    }
                }, false);    
            }
            return b;
        };
        window.XMLHttpRequest.prototype = preXhr.prototype;
    }
    
    //js错误监听
    function errorListener(){
        window.onerror = function(msg, surl, lineNo, descr){
            var jerr = {};
            if (typeof msg == 'string' && typeof surl == 'string') {
                jerr.error_file = InsApmBi.clearUrlParam(surl);
                jerr.error_line = lineNo;
                jerr.error_msg = msg.substring(msg.length-255);
            } else if (typeof surl == 'object' && surl.ajax) {
                surl = surl.ajax.url;
                jerr.error_file = InsApmBi.clearUrlParam(surl);
                jerr.error_line = lineNo;
                jerr.error_msg = JSON.stringify(msg).substring(msg.length-255);
            }
            //推送数据
            if (jerr && jerr.error_file) {
                var url = InsApmBi.postUrl+'/jse.gif';
                InsApmBi.post_data(url, {appId: appId, clientInfo:clientInfo, page: pageInfo, jserror: jerr, clientTime: (new Date()).getTime()});
            }
        };
    }
})();
