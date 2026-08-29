document.documentElement.classList.add("js");

(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var header = document.querySelector("[data-header]");
  var progress = document.getElementById("scroll-progress");
  var menuButton = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  var scrollFrame = 0;

  function updateScroll() {
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var ratio = Math.min(1, Math.max(0, window.scrollY / max));
    header.classList.toggle("is-scrolled", window.scrollY > 16);
    progress.style.transform = "scaleX(" + ratio + ")";
    scrollFrame = 0;
  }

  function requestScrollUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }

  function setMenu(open) {
    header.dataset.open = open ? "true" : "false";
    menuButton.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  }

  menuButton.addEventListener("click", function () {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) setMenu(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setMenu(false);
      menuButton.focus();
    }
  });

  window.matchMedia("(min-width: 861px)").addEventListener("change", function (event) {
    if (event.matches) setMenu(false);
  });

  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });
  updateScroll();

  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal:not(.is-visible)"));
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    reveals.forEach(function (item) { item.classList.add("is-visible"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: "0px 0px -8%" });
    reveals.forEach(function (item) { observer.observe(item); });
  }

  var stage = document.getElementById("reaction-stage");
  var label = document.getElementById("reaction-label");
  var value = document.getElementById("reaction-value");
  var message = document.getElementById("reaction-message");
  var chart = document.getElementById("trial-chart");
  var medianNode = document.getElementById("stat-median");
  var rangeNode = document.getElementById("stat-range");
  var countNode = document.getElementById("stat-count");
  var resetButton = document.getElementById("reset-trials");

  var reactionState = "idle";
  var practiceDone = false;
  var results = [];
  var timer = 0;
  var signalTime = 0;

  function trialName() {
    return practiceDone ? "Trial " + (results.length + 1) + " of 5" : "Practice trial";
  }

  function median(values) {
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  function updateChart() {
    chart.replaceChildren();
    countNode.textContent = String(results.length);

    if (!results.length) {
      medianNode.textContent = "n/a";
      rangeNode.textContent = "n/a";
      chart.setAttribute("aria-label", "No recorded reaction-time trials yet");
      var empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = practiceDone ? "Practice complete. Start trial 1." : "Your five trials will appear here.";
      chart.appendChild(empty);
      return;
    }

    var low = Math.min.apply(null, results);
    var high = Math.max.apply(null, results);
    medianNode.textContent = String(median(results));
    rangeNode.textContent = String(high - low);
    chart.setAttribute("aria-label", results.map(function (time, index) {
      return "Trial " + (index + 1) + ": " + time + " milliseconds";
    }).join(". "));

    results.forEach(function (time, index) {
      var bar = document.createElement("li");
      var height = high === low ? 112 : 70 + ((time - low) / (high - low)) * 95;
      bar.className = "trial-bar";
      bar.style.height = Math.round(height) + "px";
      bar.innerHTML = "<strong>" + time + "</strong><span>T" + (index + 1) + "</span>";
      chart.appendChild(bar);
    });
  }

  function showIdle() {
    reactionState = results.length === 5 ? "complete" : "idle";
    stage.dataset.state = reactionState;
    stage.disabled = results.length === 5;

    if (results.length === 5) {
      label.textContent = "Five trials complete";
      value.textContent = median(results) + " ms";
      message.textContent = "That is your median. Reset to run another set.";
      return;
    }

    label.textContent = trialName();
    value.textContent = practiceDone || results.length ? "Continue" : "Start";
    message.textContent = practiceDone
      ? "Press to begin. Wait for the color change, then press again."
      : "The first result is practice and will not count in your summary.";
  }

  function beginTrial() {
    if (results.length === 5) return;
    clearTimeout(timer);
    reactionState = "waiting";
    stage.dataset.state = reactionState;
    label.textContent = trialName();
    value.textContent = "Wait";
    message.textContent = "Do not press yet.";

    timer = window.setTimeout(function () {
      reactionState = "ready";
      signalTime = performance.now();
      stage.dataset.state = reactionState;
      value.textContent = "Now";
      message.textContent = "Press as quickly as you can.";
    }, 1400 + Math.random() * 1900);
  }

  function finishTrial() {
    var elapsed = Math.max(1, Math.round(performance.now() - signalTime));

    if (!practiceDone) {
      practiceDone = true;
      reactionState = "result";
      stage.dataset.state = reactionState;
      label.textContent = "Practice complete";
      value.textContent = elapsed + " ms";
      message.textContent = "This one does not count. Press to begin trial 1 of 5.";
      updateChart();
      return;
    }

    results.push(elapsed);
    reactionState = results.length === 5 ? "complete" : "result";
    stage.dataset.state = reactionState;
    label.textContent = results.length === 5 ? "Set complete" : "Trial " + results.length + " recorded";
    value.textContent = elapsed + " ms";
    message.textContent = results.length === 5
      ? "Review your median and range below."
      : "Press to begin trial " + (results.length + 1) + " of 5.";
    updateChart();

    if (results.length === 5) {
      stage.disabled = true;
      window.setTimeout(function () { resetButton.focus(); }, 0);
    }
  }

  stage.addEventListener("click", function () {
    if (reactionState === "waiting") {
      clearTimeout(timer);
      reactionState = "early";
      stage.dataset.state = reactionState;
      label.textContent = trialName();
      value.textContent = "Too soon";
      message.textContent = "That press came before the signal. Press to retry this trial.";
      return;
    }

    if (reactionState === "ready") {
      finishTrial();
      return;
    }

    beginTrial();
  });

  resetButton.addEventListener("click", function () {
    clearTimeout(timer);
    practiceDone = false;
    results = [];
    stage.disabled = false;
    updateChart();
    showIdle();
    stage.focus();
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden || reactionState !== "waiting") return;
    clearTimeout(timer);
    showIdle();
    message.textContent = "The trial paused when this tab was hidden. Press to restart it.";
  });

  updateChart();
  showIdle();

  var hero = document.querySelector(".hero");
  var canvas = document.getElementById("signal-field");
  var context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  var points = [];
  var edges = [];
  var mouse = { x: -1000, y: -1000, active: false };
  var canvasFrame = 0;

  function randomGenerator(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      var number = Math.imul(seed ^ seed >>> 15, 1 | seed);
      number = number + Math.imul(number ^ number >>> 7, 61 | number) ^ number;
      return ((number ^ number >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildField() {
    if (!context) return;
    var width = hero.clientWidth;
    var height = hero.clientHeight;
    var scale = Math.min(window.devicePixelRatio || 1, 1.5);
    var random = randomGenerator(20260829);
    var total = width < 700 ? 30 : 54;
    var limit = width < 700 ? 118 : 155;

    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    points = [];
    edges = [];

    for (var index = 0; index < total; index += 1) {
      points.push({
        x: random() * width,
        y: random() * height,
        radius: 1.2 + random() * 2.2
      });
    }

    for (var first = 0; first < points.length; first += 1) {
      for (var second = first + 1; second < points.length; second += 1) {
        var dx = points[first].x - points[second].x;
        var dy = points[first].y - points[second].y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < limit) edges.push([first, second, 1 - distance / limit]);
      }
    }
    drawField();
  }

  function shifted(point) {
    if (!mouse.active || reducedMotion.matches) return point;
    var dx = point.x - mouse.x;
    var dy = point.y - mouse.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    if (!distance || distance > 170) return point;
    var force = (1 - distance / 170) * 15;
    return { x: point.x + dx / distance * force, y: point.y + dy / distance * force, radius: point.radius };
  }

  function drawField() {
    if (!context) return;
    var width = hero.clientWidth;
    var height = hero.clientHeight;
    context.clearRect(0, 0, width, height);

    edges.forEach(function (edge) {
      var start = shifted(points[edge[0]]);
      var end = shifted(points[edge[1]]);
      var blend = ((start.x + end.x) / 2) / width;
      context.strokeStyle = blend > .58 ? "rgba(255,115,0," + (.07 + edge[2] * .11) + ")" : "rgba(243,22,88," + (.06 + edge[2] * .1) + ")";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    });

    points.forEach(function (point) {
      var current = shifted(point);
      context.fillStyle = current.x / width > .58 ? "rgba(255,132,45,.55)" : "rgba(243,39,99,.48)";
      context.beginPath();
      context.arc(current.x, current.y, current.radius, 0, Math.PI * 2);
      context.fill();
    });
    canvasFrame = 0;
  }

  function requestFieldDraw() {
    if (!canvasFrame) canvasFrame = requestAnimationFrame(drawField);
  }

  if (context) {
    buildField();
    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(buildField, 150);
    }, { passive: true });

    if (!reducedMotion.matches && window.matchMedia("(pointer: fine)").matches) {
      hero.addEventListener("pointermove", function (event) {
        var bounds = hero.getBoundingClientRect();
        mouse.x = event.clientX - bounds.left;
        mouse.y = event.clientY - bounds.top;
        mouse.active = true;
        requestFieldDraw();
      }, { passive: true });

      hero.addEventListener("pointerleave", function () {
        mouse.active = false;
        requestFieldDraw();
      });
    }

    reducedMotion.addEventListener("change", buildField);
  }

  var visual = document.querySelector(".hero-visual");
  var signalCard = document.querySelector(".signal-card");
  if (visual && signalCard && !reducedMotion.matches && window.matchMedia("(pointer: fine)").matches) {
    visual.addEventListener("pointermove", function (event) {
      var bounds = visual.getBoundingClientRect();
      var x = (event.clientX - bounds.left) / bounds.width - .5;
      var y = (event.clientY - bounds.top) / bounds.height - .5;
      signalCard.style.transform = "rotateY(" + (-5 + x * 4) + "deg) rotateX(" + (2 - y * 4) + "deg)";
    }, { passive: true });

    visual.addEventListener("pointerleave", function () {
      signalCard.style.transform = "rotateY(-5deg) rotateX(2deg)";
    });
  }
})();
