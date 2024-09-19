(function () {
    "use strict";
    let canvas, gl, shaderProgram;
    let timeUniformLocation, resolutionUniformLocation, mouseUniformLocation;
    let parameterLocations = {};
    let color1Location, color2Location, audioLevelLocation;
    let uBackgroundTimeScaleLocation, uRecordTimeScaleLocation;
    let mousePosition = {
      x: 0,
      y: 0
    };
    let startTime;
    let currentVisualizationIndex = 0;
    let tracks = [];
    let audioContext;
    let analyser;
    let audioSource;
    let dataArray;
    let audioLevel = 0.0;
    let mode = null;
    let isPlaying = false;
    let currentTrackDuration = 0;
    let currentTrackStartTime = 0;
    let currentConfig = {
      uDetailLevel: 0.5,
      uMovementSpeed: 0.25,
      uColorIntensity: 0.15,
      uGlowStrength: 0.3,
      uShapeComplexity: 0.25,
      uColor1: [0.1, 0.2, 0.3],
      uColor2: [0.5, 0.0, 0.5],
      uBackgroundTimeScale: 0.1,
      uRecordTimeScale: 0.1
    };
    const overlay = document.getElementById("track-info");
    const trackTitleElement = document.getElementById("track-title");
    const trackArtistElement = document.getElementById("track-artist");
    const trackTimeElement = document.getElementById("track-time");
    const listenButton = document.getElementById("listen-button");
    const createButton = document.getElementById("create-button");
    const playPauseButton = document.getElementById("play-pause-button");
    const nextPresetButton = document.getElementById("next-preset-button");
    const randomPresetButton = document.getElementById("random-preset-button");
    const openControlsButton = document.getElementById("open-controls-button");
    const closeControlsButton = document.getElementById("close-controls-button");
    const controlsSidebar = document.getElementById("controls-sidebar");
    const controlsContainer = document.getElementById("controls-container");
    const createModal = document.getElementById("create-modal");
    const addTrackButton = document.getElementById("add-track-button");
    const savePlaylistButton = document.getElementById("save-playlist-button");
    const cancelButton = document.getElementById("cancel-button");
    const trackListContainer = document.getElementById("track-list");
    const tracklistOverlay = document.getElementById("tracklist-overlay");
    const tracklistContainer = document.getElementById("tracklist-container");
    const totalTimeElement = document.getElementById("total-time");
    const resetButton = document.getElementById("reset-button");
    window.addEventListener("load", initializeWebGL, false);
    let originalConfig = {};
  
    function initializeWebGL() {
      canvas = document.querySelector("canvas");
      gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) {
        console.error("WebGL not supported");
        alert("Your browser does not support WebGL");
        return;
      }
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      window.addEventListener("resize", onWindowResize, false);
      canvas.addEventListener("mousemove", onMouseMove, false);
      // Correctly retrieve shader source using .textContent
      const vertexShaderSource = document.getElementById("vertex-shader")
        .textContent;
      const fragmentShaderSource = document.getElementById("fragment-shader")
        .textContent;
      const vertexShader = compileShader(
        gl,
        gl.VERTEX_SHADER,
        vertexShaderSource
      );
      const fragmentShader = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderSource
      );
      if (!vertexShader || !fragmentShader) {
        console.error("Shader compilation failed");
        return;
      }
      shaderProgram = createShaderProgram(gl, vertexShader, fragmentShader);
      if (!shaderProgram) {
        console.error("Shader program creation failed");
        return;
      }
      // Get uniform locations
      timeUniformLocation = gl.getUniformLocation(shaderProgram, "iTime");
      resolutionUniformLocation = gl.getUniformLocation(
        shaderProgram,
        "iResolution"
      );
      mouseUniformLocation = gl.getUniformLocation(shaderProgram, "iMouse");
      parameterLocations.uDetailLevel = gl.getUniformLocation(
        shaderProgram,
        "uDetailLevel"
      );
      parameterLocations.uMovementSpeed = gl.getUniformLocation(
        shaderProgram,
        "uMovementSpeed"
      );
      parameterLocations.uColorIntensity = gl.getUniformLocation(
        shaderProgram,
        "uColorIntensity"
      );
      parameterLocations.uGlowStrength = gl.getUniformLocation(
        shaderProgram,
        "uGlowStrength"
      );
      parameterLocations.uShapeComplexity = gl.getUniformLocation(
        shaderProgram,
        "uShapeComplexity"
      );
      color1Location = gl.getUniformLocation(shaderProgram, "uColor1");
      color2Location = gl.getUniformLocation(shaderProgram, "uColor2");
      audioLevelLocation = gl.getUniformLocation(shaderProgram, "uAudioLevel");
      uBackgroundTimeScaleLocation = gl.getUniformLocation(
        shaderProgram,
        "uBackgroundTimeScale"
      );
      uRecordTimeScaleLocation = gl.getUniformLocation(
        shaderProgram,
        "uRecordTimeScale"
      );
      startTime = Date.now();
      gl.useProgram(shaderProgram);
      const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      const positionAttributeLocation = gl.getAttribLocation(
        shaderProgram,
        "a_position"
      );
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
      onWindowResize();
      initializeEventListeners();
      loadDefaultTracks();
      createVisualizationControls();
      updateVisualization(); // Ensure visualization is updated after loading tracks
      requestAnimationFrame(renderFrame);
    }
  
    function initializeEventListeners() {
      listenButton.addEventListener("click", () => {
        mode = "LISTEN";
        startListening();
      });
      createButton.addEventListener("click", () => {
        mode = "CREATE";
        openCreateModal();
      });
      playPauseButton.addEventListener("click", togglePlayPause);
      nextPresetButton.addEventListener("click", nextPreset);
      randomPresetButton.addEventListener("click", randomPreset);
      addTrackButton.addEventListener("click", addTrackInput);
      savePlaylistButton.addEventListener("click", savePlaylist);
      cancelButton.addEventListener("click", closeCreateModal);
      openControlsButton.addEventListener("click", () => {
        controlsSidebar.classList.remove("hidden");
        originalConfig = {
          ...currentConfig
        }; // Store original config when controls are opened
      });
      closeControlsButton.addEventListener("click", () => {
        controlsSidebar.classList.add("hidden");
      });
      resetButton.addEventListener("click", resetVisualization);
    }
  
    function resetVisualization() {
      currentConfig = {
        ...originalConfig
      }; // Reset currentConfig to originalConfig
      // Update UI sliders and controls with the original values
      Object.keys(currentConfig).forEach((param) => {
        const input = document.querySelector(`input[data-param="${param}"]`);
        if (input) {
          if (input.type === "range") {
            input.value = currentConfig[param] * 100;
          } else if (input.type === "color") {
            input.value = rgbToHex(currentConfig[param]);
          }
        }
      });
      updateVisualization(); // Apply the reset configuration to the shader
    }
  
    function onWindowResize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  
    function onMouseMove(event) {
      const rect = canvas.getBoundingClientRect();
      mousePosition.x = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
      mousePosition.y = ((event.clientY - rect.top) / canvas.height) * 2 - 1;
    }
  
    function renderFrame() {
      const currentTime = Date.now();
      const elapsedTime = (currentTime - startTime) / 1000;
      if (mode === "LISTEN") {
        if (analyser) {
          // Get real-time frequency data from the microphone
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          // Calculate average audio level
          audioLevel = sum / dataArray.length / 255;
          audioLevel = Math.pow(audioLevel, 1.5); // Optional: emphasize peaks
        } else {
          audioLevel = 0.0;
        }
      }
      // Update WebGL uniforms
      gl.uniform1f(audioLevelLocation, audioLevel); // Pass real-time audio level to shader
      gl.uniform1f(timeUniformLocation, elapsedTime);
      gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
      gl.uniform2f(mouseUniformLocation, mousePosition.x, mousePosition.y);
      Object.keys(parameterLocations).forEach((param) => {
        gl.uniform1f(parameterLocations[param], currentConfig[param]);
      });
      gl.uniform3fv(color1Location, currentConfig.uColor1);
      gl.uniform3fv(color2Location, currentConfig.uColor2);
      gl.uniform1f(
        uBackgroundTimeScaleLocation,
        currentConfig.uBackgroundTimeScale
      );
      gl.uniform1f(uRecordTimeScaleLocation, currentConfig.uRecordTimeScale);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Render the updated visualization
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(renderFrame);
    }
  
    function openCreateModal() {
      createModal.classList.remove("hidden");
      addTrackInput();
    }
  
    function closeCreateModal() {
      createModal.classList.add("hidden");
      trackListContainer.innerHTML = "";
    }
  
    function addTrackInput() {
      const trackDiv = document.createElement("div");
      trackDiv.classList.add("bg-gray-800", "p-4", "rounded-lg", "shadow-lg");
      const header = document.createElement("div");
      header.classList.add(
        "flex",
        "justify-between",
        "items-center",
        "mb-4",
        "cursor-pointer"
      );
      header.innerHTML = `
            <h3 class="text-xl font-semibold">New Track</h3>
            <svg class="w-6 h-6 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          `;
      const content = document.createElement("div");
      content.classList.add("hidden");
      const fileInput = createInput("file", "Choose audio file", "audio/*");
      const titleInput = createInput("text", "Title");
      const artistInput = createInput("text", "Artist");
      const visualControls = document.createElement("div");
      visualControls.classList.add("grid", "grid-cols-2", "gap-4", "mt-4");
      visualControls.appendChild(createSlider("uDetailLevel", "Detail Level"));
      visualControls.appendChild(
        createSlider("uMovementSpeed", "Movement Speed")
      );
      visualControls.appendChild(
        createSlider("uColorIntensity", "Color Intensity")
      );
      visualControls.appendChild(createSlider("uGlowStrength", "Glow Strength"));
      visualControls.appendChild(
        createSlider("uShapeComplexity", "Shape Complexity")
      );
      visualControls.appendChild(
        createSlider("uBackgroundTimeScale", "Background Time Scale")
      );
      visualControls.appendChild(
        createSlider("uRecordTimeScale", "Record Time Scale")
      );
      visualControls.appendChild(createColorPicker("uColor1", "Primary Color"));
      visualControls.appendChild(createColorPicker("uColor2", "Secondary Color"));
      const previewButton = document.createElement("button");
      previewButton.textContent = "Preview";
      previewButton.classList.add(
        "mt-4",
        "bg-blue-600",
        "hover:bg-blue-700",
        "text-white",
        "font-bold",
        "py-2",
        "px-4",
        "rounded",
        "transition",
        "duration-300"
      );
      content.appendChild(fileInput);
      content.appendChild(titleInput);
      content.appendChild(artistInput);
      content.appendChild(visualControls);
      content.appendChild(previewButton);
      trackDiv.appendChild(header);
      trackDiv.appendChild(content);
      header.addEventListener("click", () => {
        content.classList.toggle("hidden");
        header.querySelector("svg").classList.toggle("rotate-180");
      });
      previewButton.addEventListener("click", () => {
        const previewConfig = getTrackConfig(trackDiv);
        previewVisualization(previewConfig);
      });
      trackListContainer.appendChild(trackDiv);
      // Auto-expand the newly added track
      setTimeout(() => header.click(), 0);
    }
  
    function createInput(type, placeholder, accept = "") {
      const input = document.createElement("input");
      input.type = type;
      input.placeholder = placeholder;
      input.accept = accept;
      input.classList.add(
        "w-full",
        "bg-gray-700",
        "text-white",
        "rounded",
        "px-3",
        "py-2",
        "mb-2"
      );
      return input;
    }
  
    function createSlider(param, label) {
      const container = document.createElement("div");
      container.classList.add("flex", "flex-col");
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.value = "50";
      slider.classList.add("w-full");
      slider.dataset.param = param;
      const labelElement = document.createElement("label");
      labelElement.textContent = label;
      labelElement.classList.add("text-sm", "mb-1");
      container.appendChild(labelElement);
      container.appendChild(slider);
      return container;
    }
  
    function createColorPicker(colorParam, label) {
      const container = document.createElement("div");
      container.classList.add("flex", "flex-col");
      const colorPicker = document.createElement("input");
      colorPicker.type = "color";
      colorPicker.classList.add("w-full", "h-8");
      colorPicker.dataset.param = colorParam;
      const labelElement = document.createElement("label");
      labelElement.textContent = label;
      labelElement.classList.add("text-sm", "mb-1");
      container.appendChild(labelElement);
      container.appendChild(colorPicker);
      return container;
    }
  
    function getTrackConfig(trackDiv) {
      const config = {};
      trackDiv
        .querySelectorAll('input[type="range"], input[type="color"]')
        .forEach((input) => {
          if (input.type === "range") {
            config[input.dataset.param] = parseFloat(input.value) / 100;
          } else if (input.type === "color") {
            config[input.dataset.param] = hexToRgb(input.value);
          }
        });
      return config;
    }
  
    function hexToRgb(hex) {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return [r, g, b];
    }
  
    function previewVisualization(config) {
      const originalConfig = {
        ...currentConfig
      };
      currentConfig = config;
      // Remove backdrop when previewing
      document.getElementById("create-modal").classList.add("bg-opacity-0");
      setTimeout(() => {
        currentConfig = originalConfig;
        document.getElementById("create-modal").classList.remove("bg-opacity-0");
      }, 5000);
    }
  
    function parseFileName(fileName) {
      const parts = fileName.split(" - ");
      if (parts.length === 2) {
        return {
          artist: parts[0].trim(),
          title: parts[1].trim()
        };
      }
      return {
        title: fileName
      };
    }
  
    function savePlaylist() {
      const trackDivs = trackListContainer.querySelectorAll(
        'div[class*="bg-gray-800"]'
      );
      tracks = [];
      const loadPromises = [];
      trackDivs.forEach((div) => {
        const fileInput = div.querySelector('input[type="file"]');
        const titleInput = div.querySelector('input[placeholder="Title"]');
        const artistInput = div.querySelector('input[placeholder="Artist"]');
        const file = fileInput.files[0];
        if (file) {
          const reader = new FileReader();
          const promise = new Promise((resolve, reject) => {
            reader.onload = function (e) {
              const audioData = e.target.result;
              const parsedFileName = parseFileName(file.name);
              const title = titleInput.value || parsedFileName.title;
              const artist =
                artistInput.value || parsedFileName.artist || "Unknown Artist";
              tracks.push({
                title: title,
                artist: artist,
                audioData: audioData,
                visualization: getTrackConfig(div)
              });
              resolve();
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          });
          loadPromises.push(promise);
        }
      });
      Promise.all(loadPromises)
        .then(() => {
          localStorage.setItem("customPlaylist", JSON.stringify(tracks));
          closeCreateModal();
          startPlayback(0);
        })
        .catch((err) => {
          console.error("Error loading audio files:", err);
        });
    }
  
    function startPlayback(trackIndex) {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const track = tracks[trackIndex];
      updateOverlay(track);
      updateTracklist(trackIndex);
      audioContext.decodeAudioData(
        track.audioData.slice(0),
        (buffer) => {
          if (audioSource) {
            audioSource.disconnect();
          }
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          dataArray = new Uint8Array(analyser.frequencyBinCount);
          source.connect(analyser);
          analyser.connect(audioContext.destination);
          source.start(0);
          audioSource = source;
          isPlaying = true;
          playPauseButton.textContent = "PAUSE";
          playPauseButton.classList.remove("hidden");
          currentTrackDuration = buffer.duration;
          currentTrackStartTime = Date.now();
          currentConfig = track.visualization;
          source.onended = () => {
            currentVisualizationIndex =
              (currentVisualizationIndex + 1) % tracks.length;
            startPlayback(currentVisualizationIndex);
          };
        },
        (err) => {
          console.error("Error decoding audio data:", err);
        }
      );
    }
  
    function togglePlayPause() {
      if (audioSource) {
        if (isPlaying) {
          audioSource.stop();
          isPlaying = false;
          playPauseButton.textContent = "PLAY";
        } else {
          startPlayback(currentVisualizationIndex);
        }
      }
    }
  
    function nextPreset() {
      currentVisualizationIndex = (currentVisualizationIndex + 1) % tracks.length;
      updateVisualization();
    }
  
    function randomPreset() {
      currentVisualizationIndex = Math.floor(Math.random() * tracks.length);
      updateVisualization();
    }
  
    function updateVisualization() {
      if (tracks.length === 0) {
        console.error("No tracks available");
        return;
      }
      const currentTrack = tracks[currentVisualizationIndex];
      if (!currentTrack || !currentTrack.visualization) {
        console.error("Invalid track or visualization data");
        return;
      }
      updateOverlay(currentTrack);
      // Update UI elements
      trackTitleElement.textContent = currentTrack.title;
      trackArtistElement.textContent = currentTrack.artist;
      updateTrackTime(0);
      // Update currentConfig with the current track's visualization
      currentConfig = {
        ...currentTrack.visualization
      };
      createVisualizationControls();
    }
  
    function interpolateColor(color1, color2, factor) {
      return color1.map((c, i) => c + (color2[i] - c) * factor);
    }
  
    function updateTrackTime(currentTime) {
      const remainingTime = Math.max(0, currentTrackDuration - currentTime);
      const mins = Math.floor(remainingTime / 60);
      const secs = Math.floor(remainingTime % 60);
      trackTimeElement.textContent = `${mins}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
  
    function updateOverlay(track) {
      if (track) {
        trackTitleElement.textContent = track.title;
        trackArtistElement.textContent = track.artist;
        updateTrackTime(0);
      } else {
        trackTitleElement.textContent = "";
        trackArtistElement.textContent = "";
        trackTimeElement.textContent = "";
      }
    }
  
    function updateTracklist(currentIndex = 0) {
      tracklistContainer.innerHTML = "";
      let totalSeconds = 0;
      tracks.forEach((track, index) => {
        const trackItem = document.createElement("div");
        trackItem.classList.add("flex", "justify-between", "items-center", "p-1");
        if (index === currentIndex) {
          trackItem.classList.add("bg-blue-500");
        }
        const trackInfo = document.createElement("div");
        trackInfo.textContent = `${track.title} by ${track.artist}`;
        trackItem.appendChild(trackInfo);
        tracklistContainer.appendChild(trackItem);
        totalSeconds += track.duration || 0;
      });
      totalTimeElement.textContent = formatTime(totalSeconds);
    }
  
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
  
    function startListening() {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      // Stop any currently playing track
      if (audioSource) {
        audioSource.disconnect();
        audioSource = null;
        isPlaying = false;
        playPauseButton.textContent = "PLAY";
      }
      // Get microphone input
      navigator.mediaDevices
        .getUserMedia({
          audio: true
        })
        .then((stream) => {
          if (audioSource) {
            audioSource.disconnect();
          }
          // Create MediaStreamSource from the microphone stream
          audioSource = audioContext.createMediaStreamSource(stream);
          // Create an analyser node
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          dataArray = new Uint8Array(analyser.frequencyBinCount);
          // Connect the audio source to the analyser
          audioSource.connect(analyser);
          // Visualize in real-time based on mic input
          tracklistOverlay.classList.add("hidden"); // Hide tracklist when in listen mode
          isPlaying = true;
        })
        .catch((err) => {
          console.error("Error accessing microphone:", err);
        });
    }
  
    function loadDefaultTracks() {
      tracks = [
        {
          title: "Cosmic Vortex",
          artist: "Galactic Winds",
          duration: 240,
          visualization: {
            uDetailLevel: 0.9,
            uMovementSpeed: 0.8,
            uColorIntensity: 0.7,
            uGlowStrength: 0.6,
            uShapeComplexity: 0.5,
            uColor1: [0.1, 0.0, 0.3],
            uColor2: [0.7, 0.0, 0.9],
            uBackgroundTimeScale: 0.2,
            uRecordTimeScale: 0.3
          }
        },
        {
          title: "Quantum Fluctuations",
          artist: "Particle Wave",
          duration: 180,
          visualization: {
            uDetailLevel: 0.1,
            uMovementSpeed: 0.9,
            uColorIntensity: 0.1,
            uGlowStrength: 0.9,
            uShapeComplexity: 0.1,
            uColor1: [0.0, 0.5, 1.0],
            uColor2: [1.0, 0.0, 0.5],
            uBackgroundTimeScale: 0.5,
            uRecordTimeScale: 0.6
          }
        },
        {
          title: "Nebula Dreams",
          artist: "Stardust Collective",
          duration: 300,
          visualization: {
            uDetailLevel: 0.3,
            uMovementSpeed: 0.3,
            uColorIntensity: 0.3,
            uGlowStrength: 0.3,
            uShapeComplexity: 0.3,
            uColor1: [0.2, 0.0, 0.4],
            uColor2: [0.8, 0.2, 0.6],
            uBackgroundTimeScale: 0.05,
            uRecordTimeScale: 0.07
          }
        },
        {
          title: "Solar Winds",
          artist: "Heliosphere",
          duration: 210,
          visualization: {
            uDetailLevel: 0.5,
            uMovementSpeed: 0.6,
            uColorIntensity: 0.6,
            uGlowStrength: 0.5,
            uShapeComplexity: 0.4,
            uColor1: [1.0, 0.6, 0.2],
            uColor2: [0.0, 0.2, 0.5],
            uBackgroundTimeScale: 0.2,
            uRecordTimeScale: 0.3
          }
        },
        {
          title: "Stellar Echoes",
          artist: "Gravity Well",
          duration: 190,
          visualization: {
            uDetailLevel: 0.7,
            uMovementSpeed: 0.4,
            uColorIntensity: 0.8,
            uGlowStrength: 0.7,
            uShapeComplexity: 0.6,
            uColor1: [0.1, 0.7, 0.9],
            uColor2: [0.9, 0.3, 0.1],
            uBackgroundTimeScale: 0.15,
            uRecordTimeScale: 0.25
          }
        },
        {
          title: "Lunar Reflections",
          artist: "Moonlight Harmonics",
          duration: 260,
          visualization: {
            uDetailLevel: 0.2,
            uMovementSpeed: 0.7,
            uColorIntensity: 0.5,
            uGlowStrength: 0.4,
            uShapeComplexity: 0.3,
            uColor1: [0.0, 0.4, 0.8],
            uColor2: [0.8, 0.6, 0.2],
            uBackgroundTimeScale: 0.12,
            uRecordTimeScale: 0.18
          }
        },
        {
          title: "Aurora Borealis",
          artist: "Northern Sky",
          duration: 280,
          visualization: {
            uDetailLevel: 0.8,
            uMovementSpeed: 0.5,
            uColorIntensity: 0.9,
            uGlowStrength: 0.8,
            uShapeComplexity: 0.5,
            uColor1: [0.2, 1.0, 0.5],
            uColor2: [0.0, 0.5, 0.9],
            uBackgroundTimeScale: 0.08,
            uRecordTimeScale: 0.1
          }
        },
        {
          title: "Galactic Tide",
          artist: "Cosmic Drift",
          duration: 230,
          visualization: {
            uDetailLevel: 0.6,
            uMovementSpeed: 0.7,
            uColorIntensity: 0.4,
            uGlowStrength: 0.5,
            uShapeComplexity: 0.6,
            uColor1: [0.1, 0.2, 0.3],
            uColor2: [0.7, 0.3, 0.8],
            uBackgroundTimeScale: 0.1,
            uRecordTimeScale: 0.2
          }
        },
        {
          title: "Crimson Dusk",
          artist: "Twilight Mystics",
          duration: 200,
          visualization: {
            uDetailLevel: 0.9,
            uMovementSpeed: 0.3,
            uColorIntensity: 0.6,
            uGlowStrength: 0.7,
            uShapeComplexity: 0.5,
            uColor1: [0.9, 0.2, 0.1],
            uColor2: [0.5, 0.0, 0.2],
            uBackgroundTimeScale: 0.4,
            uRecordTimeScale: 0.35
          }
        },
        {
          title: "Dark Matter",
          artist: "Event Horizon",
          duration: 220,
          visualization: {
            uDetailLevel: 0.4,
            uMovementSpeed: 0.9,
            uColorIntensity: 0.3,
            uGlowStrength: 0.2,
            uShapeComplexity: 0.8,
            uColor1: [0.0, 0.0, 0.0],
            uColor2: [0.4, 0.4, 0.4],
            uBackgroundTimeScale: 0.25,
            uRecordTimeScale: 0.3
          }
        },
        {
          title: "Supernova Pulse",
          artist: "Nova Sphere",
          duration: 250,
          visualization: {
            uDetailLevel: 0.7,
            uMovementSpeed: 0.6,
            uColorIntensity: 0.7,
            uGlowStrength: 0.8,
            uShapeComplexity: 0.6,
            uColor1: [1.0, 0.3, 0.0],
            uColor2: [0.2, 0.0, 0.7],
            uBackgroundTimeScale: 0.3,
            uRecordTimeScale: 0.4
          }
        },
        {
          title: "Celestial Surge",
          artist: "Orbital Waves",
          duration: 270,
          visualization: {
            uDetailLevel: 0.6,
            uMovementSpeed: 0.8,
            uColorIntensity: 0.4,
            uGlowStrength: 0.9,
            uShapeComplexity: 0.4,
            uColor1: [0.3, 0.1, 0.5],
            uColor2: [0.9, 0.4, 0.0],
            uBackgroundTimeScale: 0.35,
            uRecordTimeScale: 0.45
          }
        }
      ];
      updateTracklist();
      currentVisualizationIndex = 0;
      currentConfig = {
        ...tracks[currentVisualizationIndex].visualization
      };
    }
  
    function createVisualizationControls() {
      controlsContainer.innerHTML = "";
      Object.keys(currentConfig).forEach((param) => {
        const control = param.startsWith("uColor")
          ? createColorPicker(param, param.replace("u", ""))
          : createSlider(param, param.replace("u", ""));
        const input = control.querySelector("input");
        if (input.type === "range") {
          input.value = currentConfig[param] * 100;
        } else if (input.type === "color") {
          input.value = rgbToHex(currentConfig[param]);
        }
        input.addEventListener("input", (e) => {
          if (e.target.type === "range") {
            currentConfig[param] = parseFloat(e.target.value) / 100;
          } else if (e.target.type === "color") {
            currentConfig[param] = hexToRgb(e.target.value);
          }
        });
        controlsContainer.appendChild(control);
      });
    }
  
    function rgbToHex(rgb) {
      const r = Math.round(rgb[0] * 255)
        .toString(16)
        .padStart(2, "0");
      const g = Math.round(rgb[1] * 255)
        .toString(16)
        .padStart(2, "0");
      const b = Math.round(rgb[2] * 255)
        .toString(16)
        .padStart(2, "0");
      return `#${r}${g}${b}`;
    }
  
    function compileShader(glContext, shaderType, shaderSource) {
      const shader = glContext.createShader(shaderType);
      glContext.shaderSource(shader, shaderSource);
      glContext.compileShader(shader);
      if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
        console.error(
          "Error compiling shader:",
          glContext.getShaderInfoLog(shader)
        );
        glContext.deleteShader(shader);
        return null;
      }
      return shader;
    }
  
    function createShaderProgram(glContext, vertexShader, fragmentShader) {
      const program = glContext.createProgram();
      glContext.attachShader(program, vertexShader);
      glContext.attachShader(program, fragmentShader);
      glContext.linkProgram(program);
      if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
        console.error(
          "Error linking shader program:",
          glContext.getProgramInfoLog(program)
        );
        return null;
      }
      return program;
    }
  })();
  