import * as THREE from "three";
import { MindARThree } from "mindar-face-three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PRESET_QUESTIONS = [
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

const activeQuestions = PRESET_QUESTIONS;
function addLog(msg) { console.log(msg); }
const _voicesReady = new Promise(resolve => {
    const check = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) { resolve(v); return; }
        window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
    };
    if (window.speechSynthesis) check();
    else resolve([]);
});

function _pickVoice(voices) {
    const preferred = voices.find(v => v.lang === 'uk-UA')
        || voices.find(v => v.lang.startsWith('uk'))
        || voices.find(v => v.lang.startsWith('ru'))
        || voices.find(v => !v.localService)
        || voices[0];
    addLog('TTS голос: ' + (preferred ? preferred.name + ' (' + preferred.lang + ')' : 'не знайдено'));
    return preferred || null;
}

class SpeechTTS {
    constructor({ container }) {
        this.container = container;
        this.speaking = false;
        this.ttsBtn = null;
        this.statusEl = null;
        this._currentText = '';
        this._build();
    }

    _build() {
        this.container.innerHTML = '';

        this.ttsBtn = document.createElement('button');
        this.ttsBtn.className = 'tts-btn';
        this.ttsBtn.textContent = 'Озвучити';
        this.ttsBtn.title = 'Озвучити питання';
        this.container.appendChild(this.ttsBtn);

        const hint = document.createElement('div');
        hint.className = 'tts-hint';
        hint.textContent = 'Озвучити';
        this.container.appendChild(hint);

        this.statusEl = document.createElement('span');
        this.statusEl.className = 'mic-status-text';
        this.container.appendChild(this.statusEl);

        if (!window.speechSynthesis) {
            this.ttsBtn.disabled = true;
            this.statusEl.textContent = 'н/д';
            return;
        }

        this.ttsBtn.addEventListener('click', () => {
            if (this.speaking) this.stop();
            else this._doSpeak();
        });
    }

    setQuestion(question, answers) {
        const labels = ['Перший варіант', 'Другий варіант', 'Третій варіант', 'Четвертий варіант'];
        const parts = [question];
        answers.forEach((ans, i) => parts.push(labels[i] + ': ' + ans));
        this._currentText = parts.join('. ');
    }

    _adaptForRussian(text) {
        let t = text;
        t = t.replace(/['ʼ]/g, 'ъ');
        t = t.replace(/ї/g, 'йи');
        t = t.replace(/и/g, 'ы');
        t = t.replace(/і/g, 'и');
        t = t.replace(/е/g, 'э');
        return t;
    }

    async _doSpeak() {
        if (!this._currentText) return;

        window.speechSynthesis.cancel();

        const voices = await _voicesReady;
        const voice = _pickVoice(voices);

        if (!voice) {
            this.statusEl.textContent = 'голос не знайдено';
            return;
        }

        let textToSpeak = this._currentText;
        if (voice.lang.startsWith('ru')) {
            textToSpeak = this._adaptForRussian(textToSpeak);
            addLog('TTS: текст адаптовано для російського голосу');
        }

        const utter = new SpeechSynthesisUtterance(textToSpeak);
        utter.voice = voice;
        utter.lang = voice.lang;
        utter.rate = 0.9;
        utter.pitch = 1;
        utter.volume = 1;

        utter.onstart = () => {
            this.speaking = true;
            this.ttsBtn.classList.add('active');
            this.ttsBtn.textContent = 'Стоп';
            this.statusEl.textContent = 'Гов.';
            addLog('TTS: говорить...');
        };
        utter.onend = () => {
            this.speaking = false;
            this.ttsBtn.classList.remove('active');
            this.ttsBtn.textContent = 'Озвучити';
            this.statusEl.textContent = '';
            addLog('TTS: завершив');
        };
        utter.onerror = (e) => {
            this.speaking = false;
            this.ttsBtn.classList.remove('active');
            this.ttsBtn.textContent = 'Озвучити';
            this.statusEl.textContent = '';
            addLog('TTS помилка: ' + e.error);
        };

        addLog('TTS speak(): ' + textToSpeak.slice(0, 60));
        window.speechSynthesis.speak(utter);
    }

    stop() {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        this.speaking = false;
        if (this.ttsBtn) { this.ttsBtn.classList.remove('active'); this.ttsBtn.textContent = 'Озвучити'; }
        if (this.statusEl) this.statusEl.textContent = '';
    }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const fixedCommands = {
    'червоний': 0, 'червона': 0, 'червоне': 0, 'red': 0,
    'синій': 1, 'синя': 1, 'синє': 1, 'blue': 1,
    'зелений': 2, 'зелена': 2, 'зелене': 2, 'green': 2,
    'жовтий': 3, 'жовта': 3, 'жовте': 3, 'yellow': 3,
    'перший': 0, 'перша': 0, 'перше': 0, 'один': 0,
    'другий': 1, 'друга': 1, 'друге': 1, 'два': 1,
    'третій': 2, 'третя': 2, 'третє': 2, 'три': 2,
    'четвертий': 3, 'четверта': 3, 'четверте': 3, 'чотири': 3,
};

function buildVocabulary(answersArray) {
    const vocab = { ...fixedCommands };
    answersArray.forEach((answer, idx) => {
        const word = answer.toLowerCase().trim();
        if (word) vocab[word] = idx;
    });
    return vocab;
}

function findVoiceMatch(text, vocab) {
    for (const w of text.split(/\s+/)) {
        if (vocab.hasOwnProperty(w)) return vocab[w];
    }
    for (const key of Object.keys(vocab)) {
        if (text.includes(key)) return vocab[key];
    }
    return null;
}

class SpeechMic {
    constructor({ container, onAnswer }) {
        this.container = container;
        this.onAnswer = onAnswer;
        this.micOn = false;
        this.recognition = null;
        this.mediaStream = null;
        this.vocab = {};
        this.micBtn = null;
        this.micStatus = null;
        this._build();
    }

    _build() {
        this.container.innerHTML = '';

        this.micBtn = document.createElement('button');
        this.micBtn.className = 'mic-btn';
        this.micBtn.textContent = 'Мікрофон';
        this.micBtn.title = 'Увімкнути мікрофон';
        this.container.appendChild(this.micBtn);

        const hint = document.createElement('div');
        hint.className = 'mic-hint';
        hint.textContent = 'Голос';
        this.container.appendChild(hint);

        this.micStatus = document.createElement('span');
        this.micStatus.className = 'mic-status-text';
        this.container.appendChild(this.micStatus);

        this.micBtn.addEventListener('click', () => this.toggle());
    }

    setVocab(vocab) { this.vocab = vocab; }

    async start() {
        if (!SpeechRecognition) { this.micStatus.textContent = 'Не підтримується'; return; }
        if (this.micOn) return;

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) { this.micStatus.textContent = 'Помилка: ' + e.message; return; }

        this.micOn = true;
        this.micBtn.classList.add('active');
        this.micStatus.textContent = 'Слухаю...';

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'uk-UA';
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.onerror = (e) => {
            addLog('Помилка розпізнавання: ' + e.error);
            if (e.error === 'not-allowed') this.stop();
        };
        this.recognition.onend = () => { if (this.micOn) this.recognition.start(); };
        this.recognition.onresult = (event) => {
            const text = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
            addLog('Розпізнано: "' + text + '"');
            this.micStatus.textContent = `«${text}»`;
            const idx = findVoiceMatch(text, this.vocab);
            if (idx !== null) this.onAnswer(idx);
        };
        this.recognition.start();
    }

    stop() {
        this.micOn = false;
        if (this.recognition) { this.recognition.onend = null; this.recognition.stop(); this.recognition = null; }
        if (this.mediaStream) { this.mediaStream.getTracks().forEach(t => t.stop()); this.mediaStream = null; }
        if (this.micBtn) { this.micBtn.classList.remove('active'); }
        if (this.micStatus) this.micStatus.textContent = '';
    }

    toggle() { if (this.micOn) this.stop(); else this.start(); }
}

const modeScreen = document.getElementById('mode-select-screen');
const stepMode   = document.getElementById('step-mode');

document.getElementById('btn-mindar').addEventListener('click', () => {
    modeScreen.classList.add('hidden');
    document.getElementById('mindar-mode').classList.remove('hidden');
    startMindAR();
});
document.getElementById('btn-webxr').addEventListener('click', () => {
    modeScreen.classList.add('hidden');
    document.getElementById('webxr-mode').classList.remove('hidden');
    initWebXRMode();
});

function startMindAR() {
    const arContainer = document.getElementById('ar-container');
    const backButton  = document.getElementById('backButton');

    let currentQuestion = 0;
    let correctCount = 0;
    const questions = activeQuestions;
    const totalQ    = questions.length;

    const wheelEl         = document.getElementById('wheel');
    const questionTextEl  = document.getElementById('questionText');
    const progressEl      = document.getElementById('progress');
    const progressBarFill = document.getElementById('progressBarFill');
    const resultEl        = document.getElementById('result');
    const resultTextEl    = document.getElementById('resultText');
    const restartBtn      = document.getElementById('restartBtn');
    const sectors         = document.querySelectorAll('.sector');
    const micContainer    = document.getElementById('mic-container');
    const ttsContainer    = document.getElementById('tts-container');

    const mic = new SpeechMic({ container: micContainer, onAnswer: (idx) => handleAnswer(idx) });
    const tts = new SpeechTTS({ container: ttsContainer });

    function showQuestion(index) {
        const q = questions[index];
        questionTextEl.textContent = q.question;
        progressEl.textContent = `Питання ${index + 1} / ${totalQ}`;
        progressBarFill.style.width = ((index / totalQ) * 100) + '%';
        sectors.forEach((s, i) => {
            s.querySelector('span').textContent = q.answers[i];
            s.classList.remove('selected', 'correct', 'wrong');
            s.style.pointerEvents = 'auto';
        });
        mic.setVocab(buildVocabulary(q.answers));
        tts.setQuestion(q.question, q.answers);
        tts.stop();
    }

    function handleAnswer(selectedIndex) {
        const q = questions[currentQuestion];
        const isCorrect = selectedIndex === q.correct;
        tts.stop();
        sectors.forEach((s, i) => {
            s.style.pointerEvents = 'none';
            s.classList.add('selected');
            if (i === q.correct) s.classList.add('correct');
            else if (i === selectedIndex && !isCorrect) s.classList.add('wrong');
        });
        if (isCorrect) correctCount++;
        setTimeout(() => {
            currentQuestion++;
            if (currentQuestion < totalQ) showQuestion(currentQuestion);
            else showResult();
        }, 800);
    }

    function showResult() {
        tts.stop();
        wheelEl.classList.add('hidden');
        questionTextEl.style.display = 'none';
        progressEl.style.display = 'none';
        document.querySelector('.progress-bar-container').style.display = 'none';
        document.getElementById('controls-row').style.display = 'none';
        resultEl.style.display = 'flex';
        resultTextEl.textContent = `Ви відповіли правильно на ${correctCount} з ${totalQ}`;
        mic.stop();
    }

    function restartQuiz() {
        currentQuestion = 0; correctCount = 0;
        wheelEl.classList.remove('hidden');
        questionTextEl.style.display = '';
        progressEl.style.display = '';
        document.querySelector('.progress-bar-container').style.display = '';
        document.getElementById('controls-row').style.display = '';
        resultEl.style.display = 'none';
        showQuestion(0);
    }

    sectors.forEach(s => s.addEventListener('click', function () {
        handleAnswer(parseInt(this.getAttribute('data-index')));
    }));
    restartBtn.addEventListener('click', restartQuiz);
    backButton.addEventListener('click', () => {
        mic.stop(); tts.stop();
        document.getElementById('mindar-mode').classList.add('hidden');
        stepMode.classList.remove('hidden');
        modeScreen.classList.remove('hidden');
    });

    showQuestion(0);

    (async () => {
        const mindarThree = new MindARThree({ container: arContainer, uiScanning: 'yes', uiLoading: 'yes' });
        const { scene, camera, renderer } = mindarThree;
        renderer.sortObjects = true;
        renderer.autoClear = false;
        renderer.setSize(arContainer.clientWidth, arContainer.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.5));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(0, 1, 1);
        scene.add(dirLight);
        const faceMesh = mindarThree.addFaceMesh();
        faceMesh.material = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0, depthWrite: false, depthTest: false, colorWrite: false });
        faceMesh.renderOrder = -1;
        scene.add(faceMesh);
        const loader = new GLTFLoader();
        loader.load('./Taras.glb', (gltf) => {
            const headModel = gltf.scene;
            headModel.scale.set(28, 28, 28);
            headModel.position.set(-2, -2.3, -10);
            headModel.rotation.set(-0.1, 0.1, 0);
            headModel.traverse((child) => { if (child.isMesh) { child.renderOrder = 5; child.material.depthTest = true; child.material.depthWrite = true; } });
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
        renderer.setAnimationLoop(() => { renderer.clear(); renderer.render(scene, camera); });
    })();
}

function initWebXRMode() {
    const canvas         = document.getElementById('webxr-canvas');
    const startOverlay   = document.getElementById('webxr-start-overlay');
    const startBtn       = document.getElementById('webxr-start-btn');
    const noSupportEl    = document.getElementById('webxr-no-support');
    const quizOverlay    = document.getElementById('webxr-quiz-overlay');
    const backBtn        = document.getElementById('webxr-back');
    const progressBarFill= document.getElementById('webxr-progress-bar-fill');
    const progressText   = document.getElementById('webxr-progress-text');
    const questionText   = document.getElementById('webxr-question-text');
    const answersEl      = document.getElementById('webxr-answers');
    const micContainer   = document.getElementById('webxr-mic-container');
    const ttsContainer   = document.getElementById('webxr-tts-container');
    const resultEl       = document.getElementById('webxr-result');
    const resultText     = document.getElementById('webxr-result-text');
    const restartBtn     = document.getElementById('webxr-restart-btn');

    const questions = activeQuestions;
    let currentQuestion = 0, correctCount = 0;
    const totalQ = questions.length;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.sortObjects = true;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(0, 1, 1);
    scene.add(dirLight);

    let modelRoot = null, modelPlaced = false;
    let mixer = null;
    let yesAction = null, noAction = null;
    const clock = new THREE.Clock();

    new GLTFLoader().load('./FullTaras.glb', (gltf) => {
        modelRoot = gltf.scene;
        modelRoot.scale.set(0.4, 0.4, 0.4);
        modelRoot.visible = false;
        modelRoot.traverse((child) => { if (child.isMesh) { child.renderOrder = 1; child.material.depthTest = true; child.material.depthWrite = true; } });
        scene.add(modelRoot);

        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(modelRoot);
            const yesClip = gltf.animations.find(c => c.name === 'Yes');
            const noClip = gltf.animations.find(c => c.name === 'No');
            if (yesClip) yesAction = mixer.clipAction(yesClip);
            if (noClip) noAction = mixer.clipAction(noClip);
            if (!yesAction) addLog('WebXR: анімація "Yes" не знайдена');
            if (!noAction) addLog('WebXR: анімація "No" не знайдена');
        }
    });

    const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    reticle.renderOrder = 2;
    scene.add(reticle);

    let relocateMode = false;
    const relocateBtn = document.createElement('button');
    relocateBtn.id = 'webxr-relocate-btn';
    relocateBtn.textContent = 'Переставити';
    relocateBtn.className = 'webxr-relocate-btn';
    relocateBtn.style.display = 'none';
    relocateBtn.addEventListener('click', () => {
        if (!modelPlaced || !modelRoot) return;
        relocateMode = true;
        relocateBtn.style.display = 'none';
    });
    quizOverlay.appendChild(relocateBtn);

    (async () => {
        if (!navigator.xr) { noSupportEl.classList.remove('hidden'); startBtn.disabled = true; return; }
        const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
        if (!supported) { noSupportEl.classList.remove('hidden'); startBtn.disabled = true; }
    })();

    let xrSession = null, xrHitTestSource = null, xrRefSpace = null;

    const mic = new SpeechMic({ container: micContainer, onAnswer: (idx) => handleAnswer(idx) });
    const tts = new SpeechTTS({ container: ttsContainer });

    function playAnimation(action) {
        if (!action) return;
        if (mixer) mixer.stopAllAction();
        action.reset();
        action.setLoop(THREE.LoopRepeat, 4);
        action.play();
    }

    startBtn.addEventListener('click', async () => {
        try {
            xrSession = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: quizOverlay },
            });
        } catch (e) {
            noSupportEl.textContent = 'Помилка запуску AR: ' + e.message;
            noSupportEl.classList.remove('hidden');
            return;
        }
        startOverlay.classList.add('hidden');
        renderer.xr.setReferenceSpaceType('local');
        await renderer.xr.setSession(xrSession);
        xrRefSpace = await xrSession.requestReferenceSpace('local');
        xrHitTestSource = await xrSession.requestHitTestSource({ space: await xrSession.requestReferenceSpace('viewer') });
        xrSession.addEventListener('end', () => {
            xrHitTestSource = null;
            xrSession = null;
            relocateMode = false;
            relocateBtn.style.display = 'none';
        });
        xrSession.addEventListener('select', () => {
            if (!modelRoot) return;
            if (reticle.visible) {
                if (!modelPlaced) {
                    modelRoot.position.setFromMatrixPosition(reticle.matrix);
                    modelRoot.visible = true;
                    modelPlaced = true;
                    reticle.visible = false;
                    relocateBtn.style.display = 'inline-block';
                } else if (relocateMode) {
                    modelRoot.position.setFromMatrixPosition(reticle.matrix);
                    reticle.visible = false;
                    relocateMode = false;
                    relocateBtn.style.display = 'inline-block';
                }
            }
        });
        renderer.setAnimationLoop((_time, frame) => {
            if (!frame) return;
            if (mixer) mixer.update(clock.getDelta());

            if (xrHitTestSource && (!modelPlaced || relocateMode)) {
                const hits = frame.getHitTestResults(xrHitTestSource);
                if (hits.length > 0) {
                    reticle.visible = true;
                    reticle.matrix.fromArray(hits[0].getPose(xrRefSpace).transform.matrix);
                } else {
                    reticle.visible = false;
                }
            } else if (modelPlaced && !relocateMode) {
                reticle.visible = false;
            }
            renderer.render(scene, camera);
        });
        showQuestion(0);
    });

    function showQuestion(index) {
        const q = questions[index];
        questionText.textContent = q.question;
        progressText.textContent = `Питання ${index + 1} / ${totalQ}`;
        progressBarFill.style.width = ((index / totalQ) * 100) + '%';
        answersEl.innerHTML = '';
        q.answers.forEach((ans, i) => {
            const btn = document.createElement('button');
            btn.className = `webxr-answer-btn ans-${i}`;
            btn.textContent = ans;
            btn.addEventListener('click', () => handleAnswer(i));
            answersEl.appendChild(btn);
        });
        resultEl.classList.add('hidden');
        mic.setVocab(buildVocabulary(q.answers));
        tts.setQuestion(q.question, q.answers);
        tts.stop();
    }

    function handleAnswer(selectedIndex) {
        const q = questions[currentQuestion];
        const isCorrect = selectedIndex === q.correct;
        tts.stop();
        answersEl.querySelectorAll('.webxr-answer-btn').forEach((btn, i) => {
            btn.disabled = true;
            if (i === q.correct) btn.classList.add('revealed');
            else if (i === selectedIndex && !isCorrect) btn.classList.add('wrong');
        });
        if (isCorrect) {
            correctCount++;
            playAnimation(yesAction);
        } else {
            playAnimation(noAction);
        }
        setTimeout(() => {
            currentQuestion++;
            if (currentQuestion < totalQ) showQuestion(currentQuestion);
            else showResult();
        }, 900);
    }

    function showResult() {
        tts.stop();
        answersEl.innerHTML = '';
        questionText.textContent = '';
        progressText.textContent = '';
        resultText.textContent = `Ви відповіли правильно на ${correctCount} з ${totalQ}`;
        resultEl.classList.remove('hidden');
        mic.stop();
    }

    restartBtn.addEventListener('click', () => { currentQuestion = 0; correctCount = 0; showQuestion(0); });
    backBtn.addEventListener('click', async () => {
        mic.stop(); tts.stop();
        if (mixer) mixer.stopAllAction();
        renderer.setAnimationLoop(null);
        if (xrSession) { await xrSession.end().catch(() => {}); xrSession = null; }
        document.getElementById('webxr-mode').classList.add('hidden');
        stepMode.classList.remove('hidden');
        modeScreen.classList.remove('hidden');
    });
    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });
}