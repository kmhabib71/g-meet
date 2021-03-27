var WrtcHelper = (function () {
  const iceConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
      {
        urls: "stun:stun1.l.google.com:19302",
      },
      {
        urls: "stun:stun2.l.google.com:19302",
      },
      {
        urls: "stun:stun3.l.google.com:19302",
      },
      {
        urls: "stun:stun4.l.google.com:19302",
      },
    ],
  };

  var _audioTrack;

  var peers_conns = [];
  var peers_con_ids = [];

  var _remoteVideoStreams = [];
  var _remoteAudioStreams = [];

  var _localVideoPlayer;

  var _rtpVideoSenders = [];
  var _rtpAudioSenders = [];

  var _serverFn;

  var VideoStates = {
    None: 0,
    Camera: 1,
    ScreenShare: 2,
  };
  var _videoState = VideoStates.None;
  var _videoCamSSTrack;
  var _isAudioMute = true;
  var _my_connid = "";

  async function _init(serFn, myconnid) {
    _my_connid = myconnid;
    _serverFn = serFn;
    _localVideoPlayer = document.getElementById("localVideoCtr");

    eventBinding();
  }

  function eventBinding() {
    $("#btnMuteUnmute").on("click", async function () {
      if (!_audioTrack) {
        await startwithAudio();
      }

      if (!_audioTrack) {
        alert("problem with audio permission");
        return;
      }

      if (_isAudioMute) {
        _audioTrack.enabled = true;
        $(this).html('<span class="material-icons">mic</span>');
        AddUpdateAudioVideoSenders(_audioTrack, _rtpAudioSenders);
      } else {
        _audioTrack.enabled = false;
        $(this).html('<span class="material-icons">mic_off</span>');

        RemoveAudioVideoSenders(_rtpAudioSenders);
      }
      _isAudioMute = !_isAudioMute;

      console.log(_audioTrack);
    });
    $("#btnStartStopCam").on("click", async function () {
      if (_videoState == VideoStates.Camera) {
        //Stop case
        await ManageVideo(VideoStates.None);
      } else {
        await ManageVideo(VideoStates.Camera);
      }
    });
    $("#btnStartStopScreenshare").on("click", async function () {
      if (_videoState == VideoStates.ScreenShare) {
        //Stop case
        await ManageVideo(VideoStates.None);
      } else {
        await ManageVideo(VideoStates.ScreenShare);
      }
    });
  }
  //Camera or Screen Share or None
  async function ManageVideo(_newVideoState) {
    if (_newVideoState == VideoStates.None) {
      $("#btnStartStopCam").html(
        '<span class="material-icons">videocam_off</span>'
      );
      $("#btnStartStopScreenshare").html(
        '<div class="present-now-wrap d-flex justify-content-center flex-column align-items-center  mr-5 cursor-pointer" id="btnStartStopScreenshare" style="height:10vh;"><div class="present-now-icon"><span class="material-icons">present_to_all</span></div><div>Present Now</div></div>'
      );
      _videoState = _newVideoState;

      ClearCurrentVideoCamStream(_rtpVideoSenders);
      return;
    }

    try {
      var vstream = null;

      if (_newVideoState == VideoStates.Camera) {
        vstream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });
      } else if (_newVideoState == VideoStates.ScreenShare) {
        vstream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });

        vstream.oninactive = (e) => {
          ClearCurrentVideoCamStream(_rtpVideoSenders);
          $("#btnStartStopScreenshare").html(
            '<div class="present-now-wrap d-flex justify-content-center flex-column align-items-center  mr-5 cursor-pointer" id="btnStartStopScreenshare" style="height:10vh;"><div class="present-now-icon"><span class="material-icons">present_to_all</span></div><div>Present Now</div></div>'
          );
        };
      }

      ClearCurrentVideoCamStream(_rtpVideoSenders);

      _videoState = _newVideoState;

      if (_newVideoState == VideoStates.Camera) {
        $("#btnStartStopCam").html(
          '<span class="material-icons">videocam</span>'
        );
        $("#btnStartStopScreenshare").text("Screen Share");
      } else if (_newVideoState == VideoStates.ScreenShare) {
        $("#btnStartStopCam").html(
          '<span class="material-icons">videocam_off</span>'
        );
        $("#btnStartStopScreenshare").html(
          '<div class="present-now-wrap d-flex justify-content-center flex-column align-items-center  mr-5 cursor-pointer" id="btnStartStopScreenshare" style="height:10vh;"><div class="present-now-icon"><span class="material-icons">present_to_all</span></div><div>Stop Present Now</div></div>'
        );
      }

      if (vstream && vstream.getVideoTracks().length > 0) {
        _videoCamSSTrack = vstream.getVideoTracks()[0];

        if (_videoCamSSTrack) {
          _localVideoPlayer.srcObject = new MediaStream([_videoCamSSTrack]);

          AddUpdateAudioVideoSenders(_videoCamSSTrack, _rtpVideoSenders);
        }
      }
    } catch (e) {
      console.log(e);
      return;
    }
  }

  function ClearCurrentVideoCamStream(rtpVideoSenders) {
    if (_videoCamSSTrack) {
      _videoCamSSTrack.stop();
      _videoCamSSTrack = null;
      _localVideoPlayer.srcObject = null;

      RemoveAudioVideoSenders(rtpVideoSenders);
    }
  }

  async function RemoveAudioVideoSenders(rtpSenders) {
    for (var con_id in peers_con_ids) {
      if (rtpSenders[con_id] && IsConnectionAvailable(peers_conns[con_id])) {
        peers_conns[con_id].removeTrack(rtpSenders[con_id]);
        rtpSenders[con_id] = null;
      }
    }
  }

  async function AddUpdateAudioVideoSenders(track, rtpSenders) {
    for (var con_id in peers_con_ids) {
      if (IsConnectionAvailable(peers_conns[con_id])) {
        if (rtpSenders[con_id] && rtpSenders[con_id].track) {
          rtpSenders[con_id].replaceTrack(track);
        } else {
          rtpSenders[con_id] = peers_conns[con_id].addTrack(track);
        }
      }
    }
  }

  async function startwithAudio() {
    try {
      var astream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      _audioTrack = astream.getAudioTracks()[0];

      _audioTrack.onmute = function (e) {
        console.log(e);
      };
      _audioTrack.onunmute = function (e) {
        console.log(e);
      };

      _audioTrack.enabled = false;
    } catch (e) {
      console.log(e);
      return;
    }
  }

  async function createConnection(connid) {
    var connection = new RTCPeerConnection(iceConfiguration);
    connection.onicecandidate = function (event) {
      console.log("onicecandidate", event.candidate);
      if (event.candidate) {
        _serverFn(
          JSON.stringify({
            iceCandidate: event.candidate,
          }),
          connid
        );
      }
    };
    connection.onicecandidateerror = function (event) {
      console.log("onicecandidateerror", event);
    };
    connection.onicegatheringstatechange = function (event) {
      console.log("onicegatheringstatechange", event);
    };
    connection.onnegotiationneeded = async function (event) {
      console.log("onnegotiationneeded", event);
      await _createOffer(connid);
    };
    connection.onconnectionstatechange = function (event) {
      console.log(
        "onconnectionstatechange",
        event.currentTarget.connectionState
      );
      if (event.currentTarget.connectionState === "connected") {
        console.log("connected");
      }
      if (event.currentTarget.connectionState === "disconnected") {
        console.log("disconnected");
      }
    };
    // New remote media stream was added
    connection.ontrack = function (event) {
      // event.track.onunmute = () => {
      //     alert('unmuted');
      // };

      if (!_remoteVideoStreams[connid]) {
        _remoteVideoStreams[connid] = new MediaStream();
      }

      if (!_remoteAudioStreams[connid])
        _remoteAudioStreams[connid] = new MediaStream();

      if (event.track.kind == "video") {
        _remoteVideoStreams[connid]
          .getVideoTracks()
          .forEach((t) => _remoteVideoStreams[connid].removeTrack(t));
        _remoteVideoStreams[connid].addTrack(event.track);
        //_remoteVideoStreams[connid].getTracks().forEach(t => console.log(t));

        var _remoteVideoPlayer = document.getElementById("v_" + connid);
        _remoteVideoPlayer.srcObject = null;
        _remoteVideoPlayer.srcObject = _remoteVideoStreams[connid];
        _remoteVideoPlayer.load();
        //$(_remoteVideoPlayer).show();

        // event.track.onmute = function() {
        //     console.log(connid + ' muted');
        //    console.log(this.muted+ ' muted');
        //    console.log(event.track.muted+ ' muted');
        //    console.log(this.readyState+ ' muted');
        //    console.log('muted',this);
        //    console.log('muted',_remoteVideoStreams[connid] );
        //    console.log('muted',_remoteVideoPlayer.paused);
        //    console.log('muted',_remoteVideoPlayer.readyState );
        //    console.log('muted',_remoteVideoPlayer.ended );
        //    if(this.muted){
        //     //_remoteVideoPlayer.srcObject = null;
        //    }
        // };
      } else if (event.track.kind == "audio") {
        var _remoteAudioPlayer = document.getElementById("a_" + connid);
        _remoteAudioStreams[connid]
          .getVideoTracks()
          .forEach((t) => _remoteAudioStreams[connid].removeTrack(t));
        _remoteAudioStreams[connid].addTrack(event.track);
        _remoteAudioPlayer.srcObject = null;
        _remoteAudioPlayer.srcObject = _remoteAudioStreams[connid];
        _remoteAudioPlayer.load();
      }
    };

    peers_con_ids[connid] = connid;
    peers_conns[connid] = connection;

    if (
      _videoState == VideoStates.Camera ||
      _videoState == VideoStates.ScreenShare
    ) {
      if (_videoCamSSTrack) {
        AddUpdateAudioVideoSenders(_videoCamSSTrack, _rtpVideoSenders);
      }
    }

    return connection;
  }

  async function _createOffer(connid) {
    //await createConnection();
    var connection = peers_conns[connid];
    console.log("connection.signalingState:" + connection.signalingState);
    var offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    //Send offer to Server
    _serverFn(
      JSON.stringify({
        offer: connection.localDescription,
      }),
      connid
    );
  }
  async function exchangeSDP(message, from_connid) {
    console.log("messag", message);
    message = JSON.parse(message);

    if (message.answer) {
      console.log("answer", message.answer);
      await peers_conns[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.answer)
      );
      console.log("connection", peers_conns[from_connid]);
    } else if (message.offer) {
      console.log("offer", message.offer);

      if (!peers_conns[from_connid]) {
        await createConnection(from_connid);
      }

      await peers_conns[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.offer)
      );
      var answer = await peers_conns[from_connid].createAnswer();
      await peers_conns[from_connid].setLocalDescription(answer);
      _serverFn(
        JSON.stringify({
          answer: answer,
        }),
        from_connid,
        _my_connid
      );
    } else if (message.iceCandidate) {
      console.log("iceCandidate", message.iceCandidate);
      if (!peers_conns[from_connid]) {
        await createConnection(from_connid);
      }

      try {
        await peers_conns[from_connid].addIceCandidate(message.iceCandidate);
      } catch (e) {
        console.log(e);
      }
    }
  }

  function IsConnectionAvailable(connection) {
    if (
      connection &&
      (connection.connectionState == "new" ||
        connection.connectionState == "connecting" ||
        connection.connectionState == "connected")
    ) {
      return true;
    } else return false;
  }

  function closeConnection(connid) {
    peers_con_ids[connid] = null;

    if (peers_conns[connid]) {
      peers_conns[connid].close();
      peers_conns[connid] = null;
    }
    if (_remoteAudioStreams[connid]) {
      _remoteAudioStreams[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      _remoteAudioStreams[connid] = null;
    }

    if (_remoteVideoStreams[connid]) {
      _remoteVideoStreams[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      _remoteVideoStreams[connid] = null;
    }
  }
  return {
    init: async function (serverFn, my_connid) {
      await _init(serverFn, my_connid);
    },
    ExecuteClientFn: async function (data, from_connid) {
      await exchangeSDP(data, from_connid);
    },
    createNewConnection: async function (connid) {
      await createConnection(connid);
    },
    closeExistingConnection: function (connid) {
      closeConnection(connid);
    },
  };
})();
var MyApp = (function () {
  var socket = null;
  var socker_url = "http://localhost:3000";
  var meeting_id = "";
  var user_id = "";

  function init(uid, mid) {
    user_id = uid;
    meeting_id = mid;

    // $("#meetingname").text(meeting_id);
    $("#me h2").text(user_id + "(Me)");
    document.title = user_id;

    SignalServerEventBinding();
    EventBinding();
    $(document).on("click", ".share-button-wrap", function () {
      var attachFileArea = document.querySelector(".show-attach-file");
      var fileeName = $("#customFile").val().split("\\").pop();
      alert(fileeName);
      var FileePath = "/attachment/" + meeting_id + "/" + fileeName + "";
      // send({
      //   type: "filee",
      //   username: user_id,
      //   meetingid: meeting_id,
      //   FileePath: FileePath,
      //   fileeName: fileeName,
      // });
      attachFileArea.innerHTML +=
        "<div class='left-align' style='display:flex;align-items:center;'><img src='assets/images/other.jpg' style='height:40px;width:40px;' class='caller-image circle'><div style='font-weight:600;margin:0 5px;'>" +
        user_id +
        "</div>: <div><a style='color:#007bff;' href='" +
        FileePath +
        "' download>" +
        fileeName +
        "</a></div></div><br/>";
      $("label.custom-file-label").text("");
      socket.emit("fileTransferToOther", {
        username: user_id,
        meetingid: meeting_id,
        FileePath: FileePath,
        fileeName: fileeName,
      });
    });
  }

  // function sentFileFunc(FileSenderMeetingID, FileSenderUsername) {

  // }
  function SignalServerEventBinding() {
    // Set up the SignalR connection
    //$.connection.hub.logging = true;

    //_hub = $.connection.webRtcHub;
    //$.connection.hub.url = _hubUrl;

    socket = io.connect();

    var serverFn = function (data, to_connid) {
      socket.emit("exchangeSDP", {
        message: data,
        to_connid: to_connid,
      });
      //_hub.server.exchangeSDP(data, to_connid);
    };

    socket.on("reset", function () {
      location.reload();
    });

    socket.on("exchangeSDP", async function (data) {
      //alert(from_connid);
      await WrtcHelper.ExecuteClientFn(data.message, data.from_connid);
    });

    socket.on("informAboutNewConnection", function (data) {
      AddNewUser(data.other_user_id, data.connId, data.userNumber);
      WrtcHelper.createNewConnection(data.connId);
    });

    socket.on("informAboutConnectionEnd", function (data) {
      $("#" + data.connId).remove();
      $(".participant-count").text(data.userCoun);
      $("#participant_" + data.connId + "").remove();
      WrtcHelper.closeExistingConnection(data.connId);
    });

    socket.on("showChatMessage", function (data) {
      var time = new Date();
      // var timeDiv = document.getElementsByClassName("top-left-time-wrap");
      var lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });

      var div = $("<div>").html(
        "<span class='font-weight-bold mr-3' style='color:black'>" +
          data.from +
          "</span> " +
          lTime +
          "</br>" +
          data.message
      );
      $("#messages").append(div);
    });
    socket.on("showFileMessage", function (data) {
      var time = new Date();
      // var timeDiv = document.getElementsByClassName("top-left-time-wrap");
      var lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });

      var attachFileArea = document.querySelector(".show-attach-file");
      // var fileeName = $("#customFile").val().split("\\").pop();
      // alert(fileeName);
      // var FileePath = "/attachment/" + meeting_id + "/" + fileeName + "";
      // send({
      //   type: "filee",
      //   username: user_id,
      //   meetingid: meeting_id,
      //   FileePath: FileePath,
      //   fileeName: fileeName,
      // });
      attachFileArea.innerHTML +=
        "<div class='left-align' style='display:flex;align-items:center;'><img src='assets/images/other.jpg' style='height:40px;width:40px;' class='caller-image circle'><div style='font-weight:600;margin:0 5px;'>" +
        data.username +
        "</div>: <div><a style='color:#007bff;' href='" +
        data.FileePath +
        "' download>" +
        data.fileeName +
        "</a></div></div><br/>";
    });

    socket.on("connect", () => {
      if (socket.connected) {
        WrtcHelper.init(serverFn, socket.id);

        if (user_id != "" && meeting_id != "") {
          socket.emit("userconnect", {
            dsiplayName: user_id,
            meetingid: meeting_id,
          });
          //_hub.server.connect(user_id, meeting_id)
        }
      }
    });

    socket.on("userconnected", function (other_users) {
      var userNumber = other_users.length;
      var userNumb = userNumber + 1;
      $("#divUsers .other").remove();
      if (other_users) {
        for (var i = 0; i < other_users.length; i++) {
          AddNewUser(
            other_users[i].user_id,
            other_users[i].connectionId,
            userNumb
          );
          WrtcHelper.createNewConnection(other_users[i].connectionId);
        }
      }
      $(".toolbox").show();
      $("#messages").show();
      $("#divUsers").show();
    });
  }

  function EventBinding() {
    $("#btnResetMeeting").on("click", function () {
      socket.emit("reset");
    });

    $("#btnsend").on("click", function () {
      //_hub.server.sendMessage($('#msgbox').val());
      socket.emit("sendMessage", $("#msgbox").val());
      $("#msgbox").val("");
    });

    $("#divUsers").on("dblclick", "video", function () {
      this.requestFullscreen();
    });
  }
  var userNum;

  function AddNewUser(other_user_id, connId, userNum) {
    var $newDiv = $("#otherTemplate").clone();
    $newDiv = $newDiv.attr("id", connId).addClass("other");
    $newDiv.find("h2").text(other_user_id);
    $newDiv.find("video").attr("id", "v_" + connId);
    $newDiv.find("audio").attr("id", "a_" + connId);
    $newDiv.show();
    $("#divUsers").append($newDiv);
    $(".in-call-wrap-up").append(
      '<div class="in-call-wrap d-flex justify-content-between align-items-center mb-3" id="participant_' +
        connId +
        '" style=""> <div class="participant-img-name-wrap display-center cursor-pointer"> <div class="participant-img"> <img src="images/me2.png" alt="" class="border border-secondary" style="height: 40px;width: 40px;border-radius: 50%;"> </div> <div class="participant-name ml-2">' +
        other_user_id +
        '</div> </div> <div class="participant-action-wrap display-center"> <div class="participant-action-dot display-center mr-2 cursor-pointer"> <span class="material-icons"> more_vert </span> </div> <div class="participant-action-pin display-center cursor-pointer"> <span class="material-icons"> push_pin </span> </div> </div> </div>'
    );

    $(".participant-count").text(userNum);
  }

  return {
    _init: function (uid, mid) {
      init(uid, mid);
    },
  };
})();
