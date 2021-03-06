let net = require('net');
let tcp = net.createServer();  // 创建 tcp server
let fs = require('fs');

// 监听 端口
tcp.listen(3000,function (){
    console.log('tcp listening 3000');
});

let pathMapping = {
    '/':'./index.html'
}

// 处理客户端连接
tcp.on('connection',function (socket){
    console.log('连接成功',socket.remotePort);

    // 客户端正常断开时执行
    socket.on('close', function () {
        console.log('关闭',socket.remotePort);
    })
    socket.on('data', function (data) {
        console.log('data',data+"")
        data = data + "";
        let pathUrl = data.split('\n')[0].split(' ')[1];
        let path = pathMapping[pathUrl] ||  '.'+pathUrl;
        if(path.slice(4) == '.css'){
            if(path != 'red.css' && path!='green'){
                path = 'red.css';
            }
        }

       try {
        let str = fs.readFileSync(path) + '';

        let strArr = str.split('\n');
        
        strArr.forEach((str,i)=>{
            setTimeout(()=>{
                console.log(socket.remotePort,i,str)
                socket.write(str+'\n')
                if(i == strArr.length -1 ){
                    socket.destroy();
                }
            },1000*i)
        })    
       } catch (error) {
           console.error(error)
        socket.destroy();
       }   
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


