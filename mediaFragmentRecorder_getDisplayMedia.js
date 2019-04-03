(async() => {
  const video = document.createElement("video");
  video.id = "video";
  document.body.appendChild(video);
  document.head.insertAdjacentHTML("beforeend", `<style>#video {cursor:none} video::-webkit-media-controls,audio::-webkit-media-controls {display:none !important;}</style>`)
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      cursor: "never", // this has little/no effect https://github.com/web-platform-tests/wpt/issues/16206
      displaySurface: "browser"
    }
  });

  console.log(stream, stream.getTracks());

  let done;
  const promise = new Promise(resolve => done = resolve);

  document.addEventListener("click", async e => {
    // setTimeout(() => document.body.requestPointerLock(), 5000);
    // try to avoid using Pointer Lock API
    await video.requestFullscreen({
      navigationUI: "hide"
    });

    let urls = await Promise.all([{
      src: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Xacti-AC8EX-Sample_video-001.ogv",
      from: 0,
      to: 4
    }, {
      src: "https://mirrors.creativecommons.org/movingimages/webm/ScienceCommonsJesseDylan_240p.webm#t=10,20"
    }, {
      from: 55,
      to: 60,
      src: "https://nickdesaulniers.github.io/netfix/demo/frag_bunny.mp4"
    }, {
      from: 0,
      to: 5,
      src: "https://raw.githubusercontent.com/w3c/web-platform-tests/master/media-source/mp4/test.mp4"
    }, {
      from: 0,
      to: 5,
      src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    }, {
      from: 0,
      to: 5,
      src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
    }, {
      src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4#t=0,6"
    }].map(async({...props
    }) => {
      const {
        src
      } = props;
      const blob = (await (await fetch(src)).blob());
      return {
        blob, ...props
      }
    }));


    const context = new AudioContext();
    const mixedAudio = context.createMediaStreamDestination();
    const [audioTrack] = mixedAudio.stream.getAudioTracks();
    const [videoTrack] = stream.getVideoTracks();

    videoTrack.cursor = "never"; // this has little/no effect
    videoTrack.applyConstraints({
      cursor: "never"
    }); // this has little/no effect
    console.log(videoTrack.cursor, videoTrack.getConstraints(), videoTrack.getSettings());
    const mediaStream = new MediaStream([videoTrack, audioTrack]);

    [videoTrack, audioTrack].forEach(track => {
      track.onended = e => console.log(e);
    });

    const source = context.createMediaElementSource(video);
    source.connect(context.destination);
    source.connect(mixedAudio);
    const recorder = new MediaRecorder(mediaStream, {
      mimeType: "video/webm;codecs=vp8,opus",
      audioBitsPerSecond: 128000,
      videoBitsPerSecond: 2500000
    });
    recorder.addEventListener("error", e => {
      console.error(e)
    });
    recorder.addEventListener("dataavailable", e => {
      console.log(e.data);
      done(URL.createObjectURL(e.data));
    });
    recorder.addEventListener("stop", e => {
      console.log(e);
      [videoTrack, audioTrack].forEach(track => track.stop());
    });

    try {
      for (let [index, {
          from, to, src, blob
        }] of urls.entries()) {
        await new Promise(resolve => {
          const url = new URL(src);
          if (url.hash.length) {
            [from, to] = url.hash.match(/\d+|\d+\.\d+/g).map(Number);
          }

          const blobURL = URL.createObjectURL(blob);

          video.addEventListener("canplay", e => {
            video.controls = false;
            // wait for fullscreen notification to toggle to off
            setTimeout(() => video.play(), index === 0 ? 7000 : 0);
          }, {
            once: true
          });

          video.addEventListener("playing", e => {
            if (recorder.state === "inactive") {
              recorder.start();
            }
          }, {
            once: true
          });


          video.addEventListener("pause", e => {
            resolve();
          }, {
            once: true
          });

          video.src = `${blobURL}#t=${from},${to}`;
        })
      }
      recorder.stop();
      await document.exitFullscreen();
    } catch (e) {
      throw e;
    }
  }, {
    once: true
  });

  return await promise;
})()
.then(console.log, console.error);
