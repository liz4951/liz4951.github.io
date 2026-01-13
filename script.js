(async () => {
  if (typeof tmImage === "undefined") {
    console.error("tmImage is not loaded! Check your script tags.");
    return;
  }

  const URL = "my_model/";

  // Hier kun je jouw classes aan geluiden en afbeeldingen koppelen

  const sounds = {
    toothbrush: new Audio("my_sounds/toothbrush.mp3"),
    feather: new Audio("my_sounds/feather.mp3"),
    football: new Audio("my_sounds/football.mp3"),
    syringe: new Audio("my_sounds/syringe.mp3"),
    candy: new Audio("my_sounds/candy.mp3"),
    carrot: new Audio("my_sounds/carrot.mp3"),
  };

  const images = {
    toothbrush: "my_images/toothbrush.png",
    feather: "my_images/feather.png",
    football: "my_images/football.png",
    candy: "my_images/candy.png",
    syringe: ["my_images/syringe_1.png", "my_images/syringe_2.png", "my_images/syringe_3.png"],
    carrot: "my_images/carrot.png",
    Neutral: "my_images/neutraal.png",
  };

  // ---

  let model = null,
    webcam = null;
  const confidenceThreshold = 0.9;
  const maxThreshold = 1.0;
  const holdTime = 2000;
  const cooldown = 4000;
  const bufferSize = 5;
  const displayHoldDuration = 5000;
  // duration between frames in ms (increase to slow animation)
  const frameDuration = 400;
  const neutralHoldDuration = 500;

  const holdStart = {};
  const lastPlayed = {};
  const predictionBuffer = {};
  let currentDetectedClass = null;
  let lastDetectionTime = 0;
  let lastNeutralTime = 0;

  const imageDiv = document.getElementById("image-display");
  imageDiv.innerHTML = `<img src="${images["Neutral"]}" alt="Neutral">`;

  // Support for animated image sequences when an images entry is an array
  const animationState = { intervalId: null, timeoutId: null };

  function clearAnimation() {
    if (animationState.intervalId) {
      clearInterval(animationState.intervalId);
      animationState.intervalId = null;
    }
    if (animationState.timeoutId) {
      clearTimeout(animationState.timeoutId);
      animationState.timeoutId = null;
    }
  }

  function showImageForClass(className) {
    clearAnimation();
    const entry = images[className] || images["Neutral"];
    if (Array.isArray(entry) && entry.length > 0) {
      let idx = 0;
      imageDiv.innerHTML = `<img src="${entry[0]}" alt="${className}">`;
      const imgEl = imageDiv.querySelector("img");
      animationState.intervalId = setInterval(() => {
        idx = (idx + 1) % entry.length;
        if (imgEl) imgEl.src = entry[idx];
      }, frameDuration);
      animationState.timeoutId = setTimeout(() => {
        clearAnimation();
        imageDiv.innerHTML = `<img src="${images["Neutral"]}" alt="Neutral">`;
      }, displayHoldDuration);
    } else {
      const src = entry;
      imageDiv.innerHTML = `<img src="${src}" alt="${className}">`;
      animationState.timeoutId = setTimeout(() => {
        imageDiv.innerHTML = `<img src="${images["Neutral"]}" alt="Neutral">`;
      }, displayHoldDuration);
    }
  }

  try {
    webcam = new tmImage.Webcam(400, 300, true, { facingMode: "user" });
    await webcam.setup();
    await webcam.play();
    document.getElementById("webcam-container").appendChild(webcam.canvas);
    console.log("Webcam ready!");
  } catch (err) {
    console.error("Webcam initialization failed:", err);
    return;
  }

  try {
    model = await tmImage.load(URL + "model.json", URL + "metadata.json");
    console.log("Model loaded!");
  } catch (err) {
    console.error("Model loading failed:", err);
    model = null;
  }

  async function loop() {
    webcam.update();
    if (model) await predict();
    requestAnimationFrame(loop);
  }

  async function predict() {
    try {
      const prediction = await model.predict(webcam.canvas);

      let highest = prediction.reduce((a, b) =>
        a.probability > b.probability ? a : b
      );
      const className = highest.className;
      const prob = highest.probability;

      if (!predictionBuffer[className]) predictionBuffer[className] = [];
      predictionBuffer[className].push(prob);
      if (predictionBuffer[className].length > bufferSize)
        predictionBuffer[className].shift();
      const avgProb =
        predictionBuffer[className].reduce((a, b) => a + b, 0) /
        predictionBuffer[className].length;

      const now = Date.now();

      if (
        currentDetectedClass &&
        now - lastDetectionTime < displayHoldDuration
      ) {
        document.getElementById(
          "prediction"
        ).innerText = `Detected: ${currentDetectedClass}`;
        return;
      }

      if (avgProb < confidenceThreshold) {
        if (
          !currentDetectedClass ||
          now - lastNeutralTime > neutralHoldDuration
        ) {
          document.getElementById("prediction").innerText = "No detection";
          clearAnimation();
          imageDiv.innerHTML = `<img src="${images["Neutral"]}" alt="Neutral">`;
          currentDetectedClass = null;
          lastNeutralTime = now;
        }
        return;
      }

      document.getElementById(
        "prediction"
      ).innerText = `Detected: ${className} (${(avgProb * 100).toFixed(2)}%)`;

      if (
        sounds[className] &&
        avgProb >= confidenceThreshold &&
        avgProb <= maxThreshold
      ) {
        if (!holdStart[className]) holdStart[className] = now;

        if (now - holdStart[className] >= holdTime) {
          if (
            !lastPlayed[className] ||
            now - lastPlayed[className] > cooldown
          ) {
            sounds[className].play();
            lastPlayed[className] = now;
            showImageForClass(className);
            currentDetectedClass = className;
            lastDetectionTime = now;
          }
          holdStart[className] = null;
        }
      } else {
        holdStart[className] = null;
      }
    } catch (err) {
      console.error("Prediction failed:", err);
    }
  }

  loop();
})();
