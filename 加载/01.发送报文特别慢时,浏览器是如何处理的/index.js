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


