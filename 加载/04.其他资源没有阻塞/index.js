let net = require('net');
let tcp = net.createServer();  // 创建 tcp server
let fs = require('fs');
let _ = require('lodash');

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
        data = data + "";
        let pathUrl = data.split('\n')[0].split(' ')[1];
        let path = pathMapping[pathUrl] ||  '.'+pathUrl;
        
       try {
        
        if(isImg(path)){
            let fileContent =  fs.readFileSync('./1.png');
            // 
            socket.write('HTTP/1.1 200 OK\n')
            socket.write('Content-Type: image/png\n')
            socket.write('\n')

            // socket.write(fileContent)
            
            
            let chunks = chunk(fileContent, 10);

           _.each(chunks,(chunk,i)=>{
                setTimeout(()=>{
                    console.log(socket.remotePort,i,'chunk')
                    socket.write(new Buffer(chunk))
                    if(i == chunks.length -1 ){
                        socket.destroy();
                    }
                },1000*i)
            }) 
        }else{
            let fileContent =  fs.readFileSync(path);
            let str =fileContent + '';
            let strArr = str.split('\n');
        
            _.each(strArr,(str,i)=>{
                setTimeout(()=>{
                    console.log(socket.remotePort,i,str)
                    socket.write(str+'\n')
                    if(i == strArr.length -1 ){
                        socket.destroy();
                    }
                },1000*i)
            })    
        }
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


function isImg(name){
    return name.slice(-4) == '.png'
}


function chunk(array, len) {
    let index = 0;
    let rs = [];
    chunkLength = Math.ceil(array.length/len);
    while(index < array.length) {
        rs.push(array.slice(index, index += chunkLength));
    }
    return rs;
}