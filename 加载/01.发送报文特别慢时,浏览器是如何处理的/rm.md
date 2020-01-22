## 描述
这一期,我们聊一下浏览器的加载

我们都知道http请求是基于tcp发送报文(message)的一种协议,
如果我们的报文是每秒一行而非一起发送,那作为浏览器会如何解析?

也就是当发送html报文特别慢时,浏览器会如何操作?

当然,这是主动发送,并非一个严谨的慢

## 环境
这个问题强调的是浏览器渲染与网络进程的关系

为了验证这个问题,我们简单的需要使用tcp连接,发送请求http请求报文

这里使用node的net,模拟http监听整个端口

并在建立连接后,发送index.html中的报文,并且设置成1s传输1行

node代码如下
```javascript
let net = require('net');
let tcp = net.createServer();  // 创建 tcp server
let fs = require('fs');

// 监听 端口
tcp.listen(3000,function (){
    console.log('tcp listening 3000');
});

// 处理客户端连接
tcp.on('connection',function (socket){
    console.log('连接成功',socket.remotePort);
    //链接成功后,直接发送index.html
    //index.html 为http中所需要的所有报文
    let str = fs.readFileSync('./index.html') + '';
    let strArr = str.split('\n');

    strArr.forEach((str,i)=>{
        setTimeout(()=>{
            console.log(i,str)
            socket.write(str+'\n')
            if(i == strArr.length -1 ){
                socket.destroy();
            }
        },1000*i)
    })
    
    // 客户端正常断开时执行
    socket.on('close', function () {
        console.log('关闭',socket.remotePort);
    })
    socket.on('data', function (data) {
        console.log('接受数据',data+'');
    })
// 客户端正异断开时执行
    socket.on('error', function (err) {
        console.log('error',err,socket.remotePort);
    });

})

tcp.on('error', function (){
    console.log('tcp error');
})

tcp.on('close', function () {
    console.log('tcp close');
})
```

对于index.html来讲一共13行(包含请求头),也就是这个请求至少要12秒才能结束

```html
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<html lang="en">
<body>
    <div>1</div>
    <div>2</div>
    <div>3</div>
    <div>4</div>
    <div>5</div>
    <div>6</div>
</body>
</html>
```

代码地址如下
https://github.com/Glimis/browser/tree/master/%E5%8A%A0%E8%BD%BD/01.%E5%8F%91%E9%80%81%E6%8A%A5%E6%96%87%E7%89%B9%E5%88%AB%E6%85%A2%E6%97%B6%2C%E6%B5%8F%E8%A7%88%E5%99%A8%E6%98%AF%E5%A6%82%E4%BD%95%E5%A4%84%E7%90%86%E7%9A%84




## 现象
执行`node index.js`，在浏览器中输入`http://127.0.0.1:3000/`
这里可观察到的现象非常明显
- 开头几秒浏览器并没有刷新
- 从某某一秒开始,浏览器1s变更一次,显示html中的内容
![](https://raw.githubusercontent.com/Glimis/browser/master/%E5%8A%A0%E8%BD%BD/01.%E5%8F%91%E9%80%81%E6%8A%A5%E6%96%87%E7%89%B9%E5%88%AB%E6%85%A2%E6%97%B6%2C%E6%B5%8F%E8%A7%88%E5%99%A8%E6%98%AF%E5%A6%82%E4%BD%95%E5%A4%84%E7%90%86%E7%9A%84/1.gif)
- TTFB指数是2s
- Download指数是10s
![](https://raw.githubusercontent.com/Glimis/browser/master/%E5%8A%A0%E8%BD%BD/01.%E5%8F%91%E9%80%81%E6%8A%A5%E6%96%87%E7%89%B9%E5%88%AB%E6%85%A2%E6%97%B6%2C%E6%B5%8F%E8%A7%88%E5%99%A8%E6%98%AF%E5%A6%82%E4%BD%95%E5%A4%84%E7%90%86%E7%9A%84/2.png)

## 解释
解释这几个现象并不复杂,首先是network的两个指标
很明显,对于http的报文来说,network将他分成两部分
- TTFB/Time To First Byte 

首字节响应时间，这里说的首字节，当然是download的第一个字节
- Content Download

就是消息主体


当然，官方描述如下，这里不再进行描述
如果有兴趣,可以在如下地址找到
https://developers.google.com/web/tools/chrome-devtools/network/understanding-resource-timing


- 开头几秒浏览器并没有刷新

很显然，这个时间段就是Content Download前的时间

浏览器并没有获取响应报文,所以如果在这期间进行取消

那这种取消会返回原有的url,而且本身页面也没有变化(毕竟没有进入渲染进程)

- 从某某一秒开始,浏览器1s变更一次,显示html中的内容

当接收到Content Download的数据后,即网络进程获取的数据,将会交给渲染进程,由渲染进程进行整理,也就是触发渲染,毫无疑问,页面算是真正的进行了跳转

在这期间进行取消,只会打断后续的网络加载,以及加载后的渲染任务,对于其他并没有影响

如果了解了上述现象,那么解释url请求为下载地址时,并不存在url跳转与页面渲染,也就非常的简单,即请求头的Content-Type,代表着要求浏览器如何解析消息主体,我们可以认为,只有（怎么可能只有）在`text/html`时,这里的报文,才会被浏览器渲染,其他时候,可能会进入下载插件,而只有进入渲染进程的url,才会改变浏览器前进后退与刷新的交互


## tcp一包的大小
当然,上面的例子是使用tcp模拟主动发送小包,相当于应用层处理,也可以叫强制刷新(传输),对于http来说更常见的是一次性发送所有报文,而后由tcp进行报文的分割

执行`http-server`(自行安装http-server)，打开`http://127.0.0.1:8080/index2.html`并在`wireshark`中输入过滤条件`tcp.port==8080`,就可以找到由tcp发送的多个报文

![](https://raw.githubusercontent.com/Glimis/browser/master/%E5%8A%A0%E8%BD%BD/01.%E5%8F%91%E9%80%81%E6%8A%A5%E6%96%87%E7%89%B9%E5%88%AB%E6%85%A2%E6%97%B6%2C%E6%B5%8F%E8%A7%88%E5%99%A8%E6%98%AF%E5%A6%82%E4%BD%95%E5%A4%84%E7%90%86%E7%9A%84/3.png)
这里不做详细探讨,总之相对于我们手动的强行发送,16K是一个包大小的范围

当然,一个tcp级别的包肯定不会像http那样,会强制应用程序强制刷新

## 刷新大小 -- 64K
本地打开index2.html，可以看到如下展示
![](https://raw.githubusercontent.com/Glimis/browser/master/%E5%8A%A0%E8%BD%BD/01.%E5%8F%91%E9%80%81%E6%8A%A5%E6%96%87%E7%89%B9%E5%88%AB%E6%85%A2%E6%97%B6%2C%E6%B5%8F%E8%A7%88%E5%99%A8%E6%98%AF%E5%A6%82%E4%BD%95%E5%A4%84%E7%90%86%E7%9A%84/3.gif)
如同按需加载一样的渲染,打开performance，可看到渲染流程如下
![](https://raw.githubusercontent.com/Glimis/browser/master/%E5%8A%A0%E8%BD%BD/01.%E5%8F%91%E9%80%81%E6%8A%A5%E6%96%87%E7%89%B9%E5%88%AB%E6%85%A2%E6%97%B6%2C%E6%B5%8F%E8%A7%88%E5%99%A8%E6%98%AF%E5%A6%82%E4%BD%95%E5%A4%84%E7%90%86%E7%9A%84/4.png)

即渲染进程在渲染数据时,最多一次渲染64K数据
## 总结
最后总结一下,对于一个可渲染的url
- 网络进程获取的内容会交给渲染进程进行渲染
- 渲染数据受服务器影响
   
    不常见,特指后台强制发送
- 渲染数据受64K影响