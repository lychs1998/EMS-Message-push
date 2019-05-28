var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 2333;
var message_push=io.of('/socket.io');
var ZongJi=require('@rodrigogs/zongji');
var zongji = new ZongJi({
    host     : 'localhost',
    user     : 'root',
    password : 'xxx'
});

app.use(express.json());

app.all('*',function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild');
  res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
  if (req.method == 'OPTIONS') {
    res.sendStatus(200); 
  }
  else {
    next();
  }
});

const { Client } = require('@elastic/elasticsearch')
var client=new Client({node:'http://localhost:9200'});
async function esSearchQuestions(keyword) {
  return await client.search({
    index:'questions',
    type:'question',
    body:{
      query:{
        match:{
          text:keyword
        },
        match:{
          question:keyword
        }
      }
    }
  })
}
app.post('/search',function(req, res) {
  const keyword=req.body.keyword;
  const type=req.body.type;
  if(type===0||type==='0'){
    esSearchQuestions(keyword).then(
      results=>{
        const messages=[]
        results.body.hits.hits.forEach(e=>{
          messages.push(e._source);
        })
        res.json(messages);
      }
    )
  } else {
    esSearchAnswers(keyword).then(
      results=>{
        const messages=[]
        results.body.hits.hits.forEach(e=>{
          messages.push(e._source);
        })
        res.json(messages);
      }
    )
  }
})

async function esSearchAnswers(keyword) {
  return await client.search({
    index:'answers',
    type:'answer',
    body:{
      query:{
        match:{
          text:keyword
        }
      }
    }
  })
}

async function esDeleteReplyMQ(answerID) {
  await client.delete({
    index:'reply_mq',
    id:answerID,
  }).catch(function(err){
    console.log(err);
  });
}


async function esSearchUserID(data){
  const {body}= await client.get({
    index:'questions',
    type:'question',
    id:data.questionID,
  }).catch(function(err){
    console.log(err);
  });
  return body._source.userID;
}

async function esPushQuestions(data) {
  const reg = /[\\\`\*\_\[\]\#\+\-\!\>]/g;
  const text=data.detail.replace(reg, "");
  await client.index({
    index:'questions',
    type:'question',
    id:data.questionID,
    body:{
      questionID:data.questionID,
      question:data.question,
      text:text,
      tags:data.tags,
      detail:data.detail,
      userID:data.userID,
      star:data.star,
      createTime:data.createTime
    }
  }).catch(function(err){
    console.log(err);
  });
}
  
async function esUpdateQuestions(data) {
  const reg = /[\\\`\*\_\[\]\#\+\-\!\>]/g;
  const text=data.detail.replace(reg, "");
  await client.update({
    index:'questions',
    type:'question',
    id:data.questionID,
    body:{
      questionID:data.questionID,
      question:data.question,
      text:text,
      tags:data.tags,
      detail:data.detail,
      userID:data.userID,
      star:data.star,
      createTime:data.createTime
    }
  }).catch(function(err){
    console.log(err);
  });
}
  
async function esDeleteQuestions(data) {
  await client.delete({
    index:'questions',
    type:'question',
    id:data.questionID,
  }).catch(function(err){
    console.log(err);
  });
}
  
async function esPushAnswers(data){
  const reg = /[\\\`\*\_\[\]\#\+\-\!\>]/g;
  const text=data.answer.replace(reg, "");
  await client.index({
    index:'answers',
    type:'answer',
    id:data.answerID,
    body:{
      answerID:data.answerID,
      questionID:data.questionID,
      text:text,
      userID:data.userID,
      star:data.star,
      answer:data.answer,
      createTime:data.createTime
    }
  }).catch(function(err){
    console.log(err);
  });
}
  
async function esUpdateAnswers(data){
  const reg = /[\\\`\*\_\[\]\#\+\-\!\>]/g;
  const text=data.answer.replace(reg, "");
  await client.update({
    index:'answers',
    type:'answer',
    id:data.answerID,
    body:{
      answerID:data.answerID,
      questionID:data.questionID,
      text:text,
      answer:data.answer,
      userID:data.userID,
      star:data.star,
      createTime:data.createTime
    }
  }).catch(function(err){
    console.log(err);
  });
}
  
async function esDeleteAnswers(data){
  await client.delete({
    index:'answers',
    type:'answer',
    id:data.answerID
  }).catch(function(err){
    console.log(err);
  });
}
  
async function esPushReplyMQ(data){
  const reg = /[\\\`\*\_\[\]\#\+\-\!\>]/g;
  const text=data.answer.replace(reg, "");
  const {body}= await client.get({
    index:'questions',
    type:'question',
    id:data.questionID
  }).catch(function(err){
    console.log(err);
  });
  var uid=body._source.userID;
  await client.index({
    index:'reply_mq',
    type:uid,
    id:data.answerID,
    body:{
      answerID:data.answerID,
      questionID:data.questionID,
      text:text,
      userID:data.userID,
      star:data.star,
      answer:data.answer,
      createTime:data.createTime
    }
  }).catch(function(err){
    console.log(err);
  });
}
  
async function esPushStarQuestion(data) {
  await client.index({
    index:'star_mq',
    type:data.userID,
    id:data.questionID,
    body:{
      question:data.question,
      text:text,
      userID:data.userID,
      star:data.star,
      createTime:data.createTime
    }
  }).catch(function(err){
    console.log(err);
  });
}

var jwt=require('jsonwebtoken');
function getUserId(token){
    return String(jwt.verify(token,'JKKLJOoasdlfj',{algorithms:['HS256']}).userID);
}

var usocket = {};

function esPushToMQ(data){
  esSearchUserID(data[0]).then(
    uid=>{
      if(uid in usocket){
        usocket[uid].emit("reply",data);
        console.log('reply');
        console.log(data);
      }else{
        console.log('push-');
        console.log(data);
        esPushReplyMQ(data[0]);
      }
    }
  )
}
async function esSearchReplyMQ(userID,socket) {
  await client.search({
    index:'reply_mq',
    type:userID,
  }).then(results=>{
    if(results.body.hits.hits.length>0){
      var messages=[]
      results.body.hits.hits.forEach(e => {
        messages.push(e._source);
        esDeleteReplyMQ(e._id);
      });
      socket.emit('reply',messages);
    }
  }).catch(function(err){
    console.log(err);
  });
}
message_push.on('connection',function(socket) {
    socket.on('login',function(msg) {
        var userID=getUserId(msg);
        if(!(userID in usocket)){
          console.log(userID+' 已连接');
          socket.username = userID;
          usocket[userID] = socket;
          esSearchReplyMQ(userID,socket);
        }
    });
    socket.on('disconnect', function(reson){
      if(socket.username in usocket){
        delete(usocket[socket.username]);
        console.log(reson);
      }
    });
});

http.listen(2333, function(){
    console.log('listening on:2333');
});

zongji.on('binlog', function(evt) {
    var event=evt.getEventName();
    var table=String(evt.tableMap[evt.tableId].tableName).toLowerCase();
    var rows=evt.rows;
    if (event==='writerows') {
        if (table==='question') {
            esPushQuestions(rows[0]);
        } else if (table==='answer') {
            esPushAnswers(rows[0]);
            esPushToMQ(rows);
        }
        console.log(evt.rows);
    } else if (event==='deleterows') {
        if (table==='question') {
            esDeleteQuestions(rows[0]);
        } else if (table==='answer') {
            esDeleteAnswers(rows[0]);
            esDeleteReplyMQ(rows[0]);
        }
        console.log(evt.rows);
    }
});

zongji.start({
    serverId:1,
    startAtEnd:true,
    includeEvents: ['tablemap','writerows','deleterows'],
    includeSchema:{'j2ee':['answer','question'],'another_db':false}
});

process.on('SIGINT', function() {
    console.log('Got SIGINT.');
    zongji.stop();
    process.exit();
});