# EMS-Message-push
Node编写的Elasticsearch+Mysql Binlog+Socket.io的消息推送与搜索端

## 简单介绍
隶属于ZUCC问答论坛项目。
### 功能
使用Zongji监听Mysql的Binlog中的增删改事件，并将数据同步到ES搜索中去，当用户的问题得到回复时，如果用户在线（Socket.io保持连接）则推送这个回答给用户，前端弹窗显示。如果用户不在线，存储在ES中，在用户上线后从ES中取出，推送回答给用户。

