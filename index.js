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
            for(var i = 0; i < count_record; i++){
                var buf_payload = new Buffer(length_record);
                buf_payload = buf.slice(10+i*length_record, 10+length_record+i*length_record);
                payload[i] = new Object();
                payload[i].IMEI = imei;
                var unix_time = parseInt(buf_payload.toString('hex', 0, 8), 16);
                payload[i].timestamp = new moment(unix_time).format('MMMM Do YYYY, H:mm:ss');
                payload[i].latitude = buf_payload.readUInt32BE(9)/10000000;
                payload[i].longitude = buf_payload.readUInt32BE(13)/10000000;
                payload[i].altitude = buf_payload.readUInt16BE(17);
                payload[i].sputnik = buf_payload.readUInt8(21);
                payload[i].speed = buf_payload.readUInt16BE(22);
                payload[i].event_io = buf_payload.readUInt8(24);
                payload[i].io_in_record = buf_payload.readUInt8(25);
                payload[i].number_of_io1b = buf_payload.readUInt8(26);
//                var number_of_io1b = buf_payload.readUInt8(26);

//                console.log(buf_payload);
            }
            var str = JSON.stringify(payload,'',4);
            console.log(str);
        }

    });
}).listen(3000);

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
        default:
            console.log("ERROR");
    }
}