/**
 * Created by creosot on 16.03.15.
 */
var net = require('net');
var moment = require('moment');
moment.locale("ru");
var crc16 = require('./libs/crc.js');

net.createServer(function(socket){
    console.log("Connected Client: " + socket.remoteAddress + ":" + socket.remotePort);
    var imei = '';
    socket.on('data', function(data){
        var buf = new Buffer(data);
        if(imei === ''){
            if(buf.length != 17 || buf.readInt16BE(0) != 15){
                myError(1);
                socket.destroy();
                return;
            }
            imei = buf.toString('ascii', 2, 17);
            socket.write('\x01');
        }
        else{
            var crc_buf = buf.slice(buf.length-2, buf.length).toString('hex');
            var crc_my = crc16(buf.slice(8, buf.length-4));
            if(crc_buf !== crc_my){
                myError(2);
                socket.destroy();
                return;
            }
            if(buf.readUInt32BE(0) != 0 || buf.readUInt8(8) != 8){
                myError(3);
                socket.destroy();
                return;
            }
            var count_record = buf.readUInt8(9);
            if(count_record != buf.readUInt8(buf.length - 5)){
                myError(4);
                socket.destroy();
                return;
            }
            var length_data_array = buf.readUInt32BE(4);
            if(length_data_array != (buf.length - 12)){
                myError(5);
                socket.destroy();
                return;
            }
            var length_record = length_data_array - 3;
            if((length_record/count_record)%1 !== 0){
                myError(6);
                socket.destroy();
                return;
            }
            var payload = [];
            var gl_length = 10;
            for(var i = 0; i < count_record; i++) {
                console.log("buf = " + buf.length);
                console.log("gl_length = " + gl_length);
                if(gl_length >= buf.length - 5){
                    myError(7);
                    socket.destroy();
                    return;
                }
                var buf_payload = buf.slice(gl_length, buf.length - 5);
                payload[i] = new Object();
                payload[i].IMEI = imei;
                var length = 26;   //start s numbers_one_byte_io
                console.log("buf_payload = " + buf_payload.length);
                console.log("length = " + length);
                if(length >= buf_payload.length){
                    myError(7);
                    socket.destroy();
                    return;
                }
                var unix_time = parseInt(buf_payload.toString('hex', 0, 8), 16);
                payload[i].timestamp = new moment(unix_time).format('MMMM Do YYYY, H:mm:ss');
                payload[i].latitude = buf_payload.readUInt32BE(9)/10000000;
                payload[i].longitude = buf_payload.readUInt32BE(13)/10000000;
                payload[i].altitude = buf_payload.readUInt16BE(17);
                payload[i].sputnik = buf_payload.readUInt8(21);
                payload[i].speed = buf_payload.readUInt16BE(22);
                payload[i].number_event_io = buf_payload.readUInt8(24);
                payload[i].numbers_io_in_record = buf_payload.readUInt8(25);
                //one_byte_io
                var numbers_one_byte_io = buf_payload.readUInt8(length);
                payload[i].numbers_one_byte_io = numbers_one_byte_io;
                length += numbers_one_byte_io * 2;  //1-one_byte_io= length=26+2=28
                console.log("1/length = " + length);
                if(++length >= buf_payload.length){ //length=29 - numbers_two_byte_io
                    myError(7);
                    socket.destroy();
                    return;
                }
                //two_byte_io
                var numbers_two_byte_io = buf_payload.readUInt8(length); //length=29
                length += numbers_two_byte_io + numbers_two_byte_io * 2;  //1-two_byte_io= length=29+3=32
                payload[i].numbers_two_byte_io = numbers_two_byte_io;
                console.log("2/length = " + length);
                if(++length >= buf_payload.length){ //length=33 - numbers_four_byte_io
                    myError(7);
                    socket.destroy();
                    return;
                }
                //four_byte_io
                var numbers_four_byte_io = buf_payload.readUInt8(length); //length=33
                length += numbers_four_byte_io + numbers_four_byte_io * 4;  //1-four_byte_io= length=33+5=38
                payload[i].numbers_four_byte_io = numbers_four_byte_io;
                console.log("4/length = " + length);
                if(++length >= buf_payload.length){ //length=39 - numbers_eight_byte_io
                    myError(7);
                    socket.destroy();
                    return;
                }
                //eight_byte_io
                var numbers_eight_byte_io = buf_payload.readUInt8(length); //length=39
                length += numbers_eight_byte_io + numbers_eight_byte_io * 8;  //1-eight_byte_io= length=39+9=48
                payload[i].numbers_eight_byte_io = numbers_eight_byte_io;
                console.log("8/length = " + length);
                if(length >= buf_payload.length){
                    myError(7);
                    socket.destroy();
                    return;
                }
                gl_length += ++length; //length=49 - 2n record
            }
            var res = buf.slice(9,10);
            console.log(res);
            socket.write('\x00' + '\x00' + '\x00' + res);
            var str = JSON.stringify(payload,'',4);
            console.log(str);
        }
    });
}).listen(3333);

function myError(code){
    switch(code){
        case 1:
            console.log("ERROR: bad IMEI.");
            break;
        case 2:
            console.log("ERROR: crc not valid.");
            break;
        case 3:
            console.log("ERROR: bad header AVL packet");
            break;
        case 4:
            console.log("ERROR: difference count record");
            break;
        case 5:
            console.log("ERROR: difference length data array");
            break;
        case 6:
            console.log("ERROR: difference length data array");
            break;
        case 7:
            console.log("ERROR: length > length_buf");
            break;
        default:
            console.log("ERROR");
    }
}