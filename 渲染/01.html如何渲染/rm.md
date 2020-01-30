## 描述
这一期,我们聊一下浏览器的渲染,html的渲染流程大致分生成与重排,重绘三部,整体结构如下


- 1.将 HTML 内容转换为dom
- 2.CSS 转换为 cssom/styleSheets
- 3.创建布局树
- 4.创建分层树
- 5.创建绘制列表，提交到合成线程(进入合成)
- 6.光栅化
- 7.返回给浏览器主线程
- 8.显示器显示

这一期,我们聊一下html内容生成dom,并根据performance观察后续几个步骤所做的操作
## 环境
测试例子只有两种

一种简单的html,如index1.html
```html
    <div>1</div>
    <div>2</div>
    <div>3</div>
```
另一种为超长的,如index2.html

## 现象
双击使用浏览器打开,并执行`performance`,针对简单的html,查看`Main`可看到
![](3.1.png)

注:

本地加载与网络加载表现有所区别,当请求为本地地址时,`network`与performance中`network`如下
![](2.png)
![](2.1.png)

当请求连接为网络连接时,请求如下
![](3.png)
![](3.1.png)

此处通过`http-server`,以查看真实网络环境的渲染情况

点击`network`，查看如下内容
![](4.png)
35.58 ms 加载时间 + 84.59 ms 等待时间(main为单线程,故存在等待时间)
 
## 网络加载前
- 触发`beforeunload`

![](5.png)     

当浏览器窗口关闭或者刷新时

- 2.Send Request

![](6.png)  

注:
Send Request表示发送请求(第一个除外)

第一个请求,需要确定解析方式以决定是否由浏览器解析,故第一次Send Request在请求响应返回之后(表现为network内)

- 3.Receive Response

![](7.png)  

接受请求响应

main是执行事件循环的线程,两个任务并不会因为已获取资源而进行合并


- 4.执行系统任务(包括回调)
![](8.png)  
依次执行pagehide,visibilitychange,webkitvisibilitychange,unload
- onpagehide
用户离开网页时触发
- visibilitychange
页面被隐藏或显示的时触发
- webkitvisibilitychange
同上
- unload
资源卸载
- readystatechange
![](9.png)  
readyState发生改变,此处指loading=interactive,进入交互期

- 5.接受数据与结束接受
![](10.png)  
Receive Data:接受数据

Finish Loading:加载结束,此时网络中断

- 6.解析dom

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