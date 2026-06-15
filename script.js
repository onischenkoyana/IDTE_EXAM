import * as THREE from "three";
import { MindARThree } from "mindar-face-three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function addLog(message) {
    console.log(message);
}

// AR
const arContainer = document.getElementById("ar-container");
const backButton = document.getElementById("backButton");

const startAR = async () => {
    const mindarThree = new MindARThree({
        container: arContainer,
        uiScanning: "yes",
        uiLoading: "yes",
    });
    const { scene, camera, renderer } = mindarThree;

    renderer.sortObjects = true;
    renderer.autoClear = false;
    renderer.setSize(arContainer.clientWidth, arContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.5));
    const directLight = new THREE.DirectionalLight(0xffffff, 1);
    directLight.position.set(0, 1, 1);
    scene.add(directLight);

    const faceMesh = mindarThree.addFaceMesh();
    faceMesh.material = new THREE.MeshBasicMaterial({
        visible: true, transparent: true, opacity: 0,
        depthWrite: false, depthTest: false, colorWrite: false
    });
    faceMesh.renderOrder = -1;
    scene.add(faceMesh);

    // налаштовуємо розміщення
    const loader = new GLTFLoader();
    loader.load("./taras.glb", (gltf) => {
        const headModel = gltf.scene;
        headModel.scale.set(28, 28, 28);
        headModel.position.set(-2, -2.3, -10);
        headModel.rotation.set(-0.1, 0.1, 0);
        headModel.traverse((child) => {
            if (child.isMesh) {
                child.renderOrder = 5;
                child.material.depthTest = true;
                child.material.depthWrite = true;
            }
        });
        faceMesh.add(headModel);
    });

    await mindarThree.start();
    camera.near = 0.01;
    camera.updateProjectionMatrix();

    window.addEventListener('resize', () => {
        renderer.setSize(arContainer.clientWidth, arContainer.clientHeight);
        camera.aspect = arContainer.clientWidth / arContainer.clientHeight;
        camera.updateProjectionMatrix();
    });

    renderer.setAnimationLoop(() => {
        renderer.clear();
        renderer.render(scene, camera);
    });
};

startAR();
backButton.addEventListener("click", () => location.reload());

// тест
const questions = [
    { question: "В якому селі народився Тарас Шевченко?", answers: ["Моринці", "Кирилівка", "Шешори", "Будище"], correct: 0 },
    { question: "Як називалася перша збірка віршів Шевченка?", answers: ["Кобзар", "Гайдамаки", "Катерина", "Тополя"], correct: 0 },
    { question: "У якому році народився Шевченко?", answers: ["1814", "1824", "1804", "1834"], correct: 0 },
    { question: "Яка поема описує Коліївщину?", answers: ["Гайдамаки", "Кавказ", "Сон", "Неофіти"], correct: 0 },
    { question: "Яка поема названа жіночим ім'ям?", answers: ["Катерина", "Наймичка", "Марія", "Лілея"], correct: 0 },
    { question: "Яку фортецю Шевченко відвідав на засланні?", answers: ["Орськ", "Київ", "Львів", "Харків"], correct: 0 },
    { question: "Хто з художників допоміг викупити Шевченка з кріпацтва?", answers: ["Брюллов", "Рєпін", "Шишкін", "Айвазовський"], correct: 0 },
    { question: "Яка річка згадується у «Заповіті»?", answers: ["Дніпро", "Дністер", "Дон", "Дунай"], correct: 0 },
    { question: "У якому місті помер Шевченко?", answers: ["Петербург", "Київ", "Москва", "Варшава"], correct: 0 },
    { question: "Яке звання отримав Шевченко в Академії мистецтв?", answers: ["Академік", "Професор", "Студент", "Художник"], correct: 0 }
];

let currentQuestion = 0;
let correctCount = 0;
const totalQuestions = questions.length;

const wheelEl = document.getElementById("wheel");
const questionTextEl = document.getElementById("questionText");
const progressEl = document.getElementById("progress");
const progressBarFill = document.getElementById("progressBarFill");
const resultEl = document.getElementById("result");
const resultTextEl = document.getElementById("resultText");
const restartBtn = document.getElementById("restartBtn");
const sectors = document.querySelectorAll(".sector");
const micContainer = document.getElementById("mic-container");

// Мовлення
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let micOn = false;
let voiceVocabulary = {};

let audioContext = null;
let mediaStream = null;
let analyser = null;
let animationId = null;

let micSelect = null;
let micBtn, micStatus;
let supportsAudioTrack = false;
let devicesReady = false;

const fixedCommands = {
    'червоний': 0, 'червона': 0, 'червоне': 0, 'red': 0,
    'синій': 1, 'синя': 1, 'синє': 1, 'blue': 1,
    'зелений': 2, 'зелена': 2, 'зелене': 2, 'green': 2,
    'жовтий': 3, 'жовта': 3, 'жовте': 3, 'yellow': 3
};

function buildVocabulary(answersArray) {
    const vocab = { ...fixedCommands };
    answersArray.forEach((answer, idx) => {
        const word = answer.toLowerCase().trim();
        if (word) vocab[word] = idx;
    });
    return vocab;
}

function buildMicUI() {
    micContainer.innerHTML = '';
    const testRec = new SpeechRecognition();
    supportsAudioTrack = (testRec.audioTrack !== undefined);
    addLog('Підтримка audioTrack: ' + supportsAudioTrack);

    if (supportsAudioTrack) {
        micSelect = document.createElement('select');
        micSelect.id = 'mic-select';
        micSelect.style.cssText = 'background:#333;color:#fff;border:1px solid #666;border-radius:8px;padding:4px 8px;font-size:0.8rem;max-width:140px;';
        micContainer.appendChild(micSelect);
    }

    micBtn = document.createElement('button');
    micBtn.id = 'mic-btn';
    micBtn.innerHTML = 'Увімкнути мікрофон';
    micContainer.appendChild(micBtn);

    const micHint = document.createElement('div');
    micHint.className = 'mic-hint';
    micHint.textContent = 'Для голосового керування';
    micContainer.appendChild(micHint);

    micStatus = document.createElement('span');
    micStatus.id = 'mic-status';
    micStatus.textContent = 'Мікрофон вимкнено';
    micContainer.appendChild(micStatus);

    micBtn.addEventListener('click', toggleMic);
}

async function getAudioDevices() {
    if (!supportsAudioTrack || !micSelect) return;
    try {
        addLog('Отримання списку мікрофонів...');
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(track => track.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        addLog('Знайдено мікрофонів: ' + audioInputs.length);
        micSelect.innerHTML = '';
        audioInputs.forEach((device, idx) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Мікрофон ${idx + 1}`;
            micSelect.appendChild(option);
            addLog(' - ' + (device.label || 'без назви') + ' (' + device.deviceId + ')');
        });
        if (audioInputs.length && !micSelect.value) {
            micSelect.value = audioInputs[0].deviceId;
        }
        devicesReady = true;
    } catch (e) {
        addLog('Помилка отримання мікрофонів: ' + e.message);
        devicesReady = false;
    }
}

async function ensureDevicesReady() {
    if (!supportsAudioTrack || !micSelect) return;
    if (!devicesReady || micSelect.options.length === 0) {
        addLog('Список мікрофонів порожній – заповнюю перед стартом...');
        await getAudioDevices();
    }
}

async function captureMicrophone(deviceId) {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    const constraints = { audio: true };
    if (deviceId && supportsAudioTrack) {
        constraints.audio = { deviceId: { exact: deviceId } };
    }
    addLog('Захоплення мікрофона: ' + JSON.stringify(constraints));
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = mediaStream.getAudioTracks()[0];
    addLog('Активна аудіодоріжка: ' + (track ? track.label : 'немає'));
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const source = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
}

async function startMic() {
    if (!SpeechRecognition) {
        addLog('SpeechRecognition не підтримується');
        micStatus.textContent = "Браузер не підтримує";
        return;
    }
    if (micOn) return;

    await ensureDevicesReady();

    const deviceId = supportsAudioTrack && micSelect ? micSelect.value : undefined;
    addLog('Спроба запуску, deviceId: ' + (deviceId || 'за замовчуванням'));

    try {
        await captureMicrophone(deviceId);
    } catch (err) {
        micStatus.textContent = "Помилка доступу: " + err.message;
        return;
    }

    micOn = true;
    micBtn.classList.add("active");
    micBtn.innerHTML = 'Вимкнути мікрофон';
    micStatus.textContent = "Говоріть...";
    addLog('Створення екземпляра SpeechRecognition');

    recognition = new SpeechRecognition();
    recognition.lang = 'uk-UA';
    recognition.continuous = true;
    recognition.interimResults = false;

    if (supportsAudioTrack && mediaStream) {
        const audioTrack = mediaStream.getAudioTracks()[0];
        if (audioTrack) {
            recognition.audioTrack = audioTrack;
            addLog('Передано аудіодоріжку в recognition.audioTrack: ' + audioTrack.label);
        }
    }

    recognition.onstart = () => {
        addLog('Розпізнавання запущено');
        micStatus.textContent = "Слухаю...";
    };
    recognition.onerror = (e) => {
        addLog('Помилка розпізнавання: ' + e.error + ' (' + (e.message || '') + ')');
        micStatus.textContent = "Помилка: " + e.error;
        if (e.error === 'not-allowed') stopMic();
    };
    // запускаємо нову сесію, коли стара завершилася
    recognition.onend = () => {
        addLog('Сесію розпізнавання завершено');
        if (micOn) {
            addLog('Перезапуск...');
            recognition.start();
        }
    };
    recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript.trim().toLowerCase();
        addLog('Розпізнано: "' + text + '"');
        micStatus.textContent = 'Почуто: "' + text + '"';
        let foundIndex = null;
        for (const word of text.split(/\s+/)) {
            if (voiceVocabulary.hasOwnProperty(word)) {
                foundIndex = voiceVocabulary[word];
                break;
            }
        }
        if (foundIndex === null) {
            for (const key of Object.keys(voiceVocabulary)) {
                if (text.includes(key)) {
                    foundIndex = voiceVocabulary[key];
                    break;
                }
            }
        }
        if (foundIndex !== null) {
            addLog('Знайдено збіг із індексом ' + foundIndex);
            handleAnswer(foundIndex);
        } else {
            addLog('Збігів не знайдено');
        }
    };

    recognition.start();
}

function stopMic() {
    micOn = false;
    addLog('Зупинка мікрофона');
    if (recognition) {
        recognition.onend = null;
        recognition.stop();
        recognition = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    micBtn.classList.remove("active");
    micBtn.innerHTML = 'Увімкнути мікрофон';
    micStatus.textContent = "Мікрофон вимкнено";
}

function toggleMic() {
    if (micOn) stopMic();
    else startMic();
}

buildMicUI();

// логіка тесту
function showQuestion(index) {
    const q = questions[index];
    questionTextEl.textContent = q.question;
    progressEl.textContent = `Питання ${index + 1} / ${totalQuestions}`;
    const progressPercent = ((index) / totalQuestions) * 100;
    progressBarFill.style.width = progressPercent + '%';

    sectors.forEach((sector, i) => {
        sector.querySelector("span").textContent = q.answers[i];
        sector.classList.remove("selected", "correct", "wrong");
        sector.style.pointerEvents = "auto";
    });
    voiceVocabulary = buildVocabulary(q.answers);
    addLog('Питання #' + (index+1) + ', словник: ' + Object.keys(voiceVocabulary).join(', '));
}

function handleAnswer(selectedIndex) {
    const q = questions[currentQuestion];
    const isCorrect = (selectedIndex === q.correct);
    addLog('Відповідь: ' + selectedIndex + ' (правильна: ' + isCorrect + ')');

    sectors.forEach((sector, i) => {
        sector.style.pointerEvents = "none";
        sector.classList.add("selected");
        if (i === q.correct) {
            sector.classList.add("correct");
        } else if (i === selectedIndex && !isCorrect) {
            sector.classList.add("wrong");
        }
    });

    if (isCorrect) correctCount++;
    setTimeout(() => {
        currentQuestion++;
        if (currentQuestion < totalQuestions) showQuestion(currentQuestion);
        else showResult();
    }, 800);
}

function showResult() {
    wheelEl.classList.add("hidden");
    questionTextEl.style.display = "none";
    progressEl.style.display = "none";
    document.querySelector('.progress-bar-container').style.display = "none";
    micContainer.style.display = "none";
    resultEl.style.display = "flex";
    resultTextEl.textContent = `Ви відповіли правильно на ${correctCount} з ${totalQuestions}`;
    stopMic();
}

function restartQuiz() {
    currentQuestion = 0;
    correctCount = 0;
    wheelEl.classList.remove("hidden");
    questionTextEl.style.display = "";
    progressEl.style.display = "";
    document.querySelector('.progress-bar-container').style.display = "";
    micContainer.style.display = "flex";
    resultEl.style.display = "none";
    showQuestion(0);
    if (micOn) startMic();
}

sectors.forEach(sector => {
    sector.addEventListener("click", function() {
        const index = parseInt(this.getAttribute("data-index"));
        handleAnswer(index);
    });
});
restartBtn.addEventListener("click", restartQuiz);

showQuestion(0);
addLog('Ініціалізацію завершено');