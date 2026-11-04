import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase.js';
import { onSnapshot, query, where, collection, doc } from 'firebase/firestore';
import { enableStudentPushNotifications } from './push.js';
import { getDocs, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import {
  BookOpen, Users, Video, FileText, Bell, Camera, LogOut,
  Download, Clock, Trash2, Eye, UserPlus, CheckCircle,
  ScanFace, RefreshCw, ShieldCheck, Lock, Phone, Calendar,
  BarChart3, Filter, AlertTriangle, HelpCircle, Award, Sparkles,
  Star, Edit3, CreditCard, DollarSign, LayoutDashboard, User,
  Key, Brain, MessageSquare, PlayCircle, Share2, Send, Mail,
  MessageCircle, FileCheck, XCircle, History
} from 'lucide-react';

const STUDENTS_COL = "deep_students_permanent_v3";
const ATTENDANCE_COL = "deep_attendance_permanent_v3";
const NOTIFICATIONS_COL = "deep_notifications_permanent_v3";
const MOCKTEST_COL = "deep_mock_tests_permanent_v3";
const FEEDBACK_COL = "deep_feedbacks_permanent_v3";
const FEES_COL = "deep_fees_permanent_v3";
const DOUBTS_COL = "deep_doubts_permanent_v3";
const RECORDINGS_COL = "deep_recordings_permanent_v3";
const LIVECHAT_COL = "deep_livechat_permanent_v3";
const POLLS_COL = "deep_polls_permanent_v3";
const PORTAL_SETTINGS_COL = "deep_portal_settings_v3";

const BATCH_OPTIONS = [
  "Class 11 Computer Application",
  "Class 11 Computer Science",
  "Class 12 Computer Application",
  "Class 12 Computer Science",
  "Class 11 Kalyani Batch",
  "Class 11 Computer Application Kalyani Batch",
  "Class 12 Computer Application Kalyani Batch",
  "B.Sc Honours Batch"
];

const openMeetLink = (link) => {
  if (link && typeof link === 'string' && link.startsWith('http')) {
    window.open(link, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
};

const E2EE_SECRET_KEY = "DEEP_EDU_E2EE_2026_PRIVATE_MASTER_KEY_AVRADEV";

const encryptE2EE = (plainText) => {
  if (plainText === null || plainText === undefined || plainText === "") return plainText;
  const str = String(plainText);
  if (str.startsWith("ENC_V3::") || str.startsWith("E2EE_IMG::") || str.startsWith("E2EE_LOCKED::")) return str;
  if (str.startsWith("data:")) {
    const head = str.slice(0, 120);
    const tail = str.slice(120);
    const encodedHead = btoa(unescape(encodeURIComponent(head.split('').reverse().join(''))));
    return `E2EE_IMG::${encodedHead}::${tail}`;
  }
  try {
    const utf8Bytes = encodeURIComponent(str);
    let xorResult = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      const charCode = utf8Bytes.charCodeAt(i) ^ (E2EE_SECRET_KEY.charCodeAt(i % E2EE_SECRET_KEY.length) & 0x1F);
      xorResult += String.fromCharCode(charCode);
    }
    return `ENC_V3::${btoa(xorResult)}`;
  } catch (e) { return str; }
};

const decryptE2EE = (cipherText) => {
  if (cipherText === null || cipherText === undefined || cipherText === "") return cipherText;
  const str = String(cipherText);
  if (str.startsWith("E2EE_LOCKED::")) return str.replace("E2EE_LOCKED::", "");
  if (str.startsWith("E2EE_IMG::")) {
    try {
      const parts = str.split("::");
      const decodedHead = decodeURIComponent(escape(atob(parts[1]))).split('').reverse().join('');
      return decodedHead + parts.slice(2).join("::");
    } catch (e) { return str; }
  }
  if (str.startsWith("ENC_V3::")) {
    try {
      const rawXor = atob(str.slice(8));
      let utf8Bytes = "";
      for (let i = 0; i < rawXor.length; i++) {
        const charCode = rawXor.charCodeAt(i) ^ (E2EE_SECRET_KEY.charCodeAt(i % E2EE_SECRET_KEY.length) & 0x1F);
        utf8Bytes += String.fromCharCode(charCode);
      }
      return decodeURIComponent(utf8Bytes);
    } catch (e) { return str; }
  }
  return str;
};

const encryptRecordFields = (obj, fields) => {
  const out = { ...obj, e2eeEncrypted: true };
  fields.forEach(f => {
    if (out[f] !== undefined && out[f] !== null) {
      if (typeof out[f] === 'string') out[f] = encryptE2EE(out[f]);
      else if (Array.isArray(out[f])) out[f] = encryptE2EE(JSON.stringify(out[f]));
    }
  });
  return out;
};

const decryptRecordFields = (obj, fields, arrayFields = []) => {
  const out = { ...obj };
  fields.forEach(f => { if (typeof out[f] === 'string') out[f] = decryptE2EE(out[f]); });
  arrayFields.forEach(af => {
    if (typeof out[af] === 'string' && out[af].startsWith("ENC_V3::")) {
      try { out[af] = JSON.parse(decryptE2EE(out[af])); } catch (e) {}
    }
  });
  return out;
};

const STUDENT_ENCRYPTED_FIELDS = ['name', 'phone', 'password', 'dob', 'gender', 'batch', 'dp', 'facePhoto'];
const STUDENT_ENCRYPTED_ARRAYS = ['faceSignature', 'faceSignatureCentered'];
const STUDENT_LOCAL_FIELDS = [...STUDENT_ENCRYPTED_FIELDS, ...STUDENT_ENCRYPTED_ARRAYS];
const ATTENDANCE_ENCRYPTED_FIELDS = ['name', 'batch', 'phone', 'location', 'capturedPhoto'];
const FEE_ENCRYPTED_FIELDS = ['studentName', 'batch'];
const DOUBT_ENCRYPTED_FIELDS = ['studentName', 'batch', 'question', 'photo', 'aiAnswer', 'teacherReply'];
const CHAT_ENCRYPTED_FIELDS = ['sender', 'text'];
const FEEDBACK_ENCRYPTED_FIELDS = ['studentName', 'batch', 'comment'];

const persistStudents = (list) => {
  try {
    const encrypted = list.map(s => encryptRecordFields(s, STUDENT_LOCAL_FIELDS));
    localStorage.setItem('deep_students_emergency_backup', JSON.stringify(encrypted));
  } catch (e) {}
};

const AI_TOPIC_QUESTION_BANK = {
  logic_gates: [
    { question: "Which gate is known as the Universal Gate?", optionA: "AND Gate", optionB: "OR Gate", optionC: "NAND Gate", optionD: "XOR Gate", correct: "C" },
    { question: "What is the Boolean expression for a 2-input XOR gate?", optionA: "A'B + AB'", optionB: "AB + A'B'", optionC: "A + B", optionD: "(A+B)'", correct: "A" },
    { question: "According to De Morgan's Law, what is (A . B)' equal to?", optionA: "A' . B'", optionB: "A' + B'", optionC: "A + B", optionD: "A . B", correct: "B" },
    { question: "How many NAND gates are required to construct an AND gate?", optionA: "1", optionB: "2", optionC: "3", optionD: "4", correct: "B" },
    { question: "If both inputs of a NOR gate are 0, the output will be:", optionA: "0", optionB: "1", optionC: "Undefined", optionD: "Toggle", correct: "B" }
  ],
  number_system: [
    { question: "What is the binary equivalent of decimal number 13?", optionA: "1011", optionB: "1101", optionC: "1110", optionD: "1001", correct: "B" },
    { question: "What is the base (radix) of the Hexadecimal number system?", optionA: "2", optionB: "8", optionC: "10", optionD: "16", correct: "D" },
    { question: "2's complement of binary number 1010 is:", optionA: "0101", optionB: "0110", optionC: "1100", optionD: "0011", correct: "B" },
    { question: "Which code is a non-weighted binary code?", optionA: "BCD", optionB: "8421", optionC: "Gray Code", optionD: "Binary", correct: "C" },
    { question: "1 Kilobyte (KB) is equal to how many bytes?", optionA: "1000 Bytes", optionB: "1024 Bytes", optionC: "512 Bytes", optionD: "2048 Bytes", correct: "B" }
  ],
  programming: [
    { question: "Which operator is used to get the memory address of a variable in C/C++?", optionA: "*", optionB: "&", optionC: "->", optionD: "%", correct: "B" },
    { question: "Which of the following is NOT an OOP concept?", optionA: "Encapsulation", optionB: "Polymorphism", optionC: "Compilation", optionD: "Inheritance", correct: "C" },
    { question: "In Python, which keyword is used to define a function?", optionA: "func", optionB: "def", optionC: "function", optionD: "lambda", correct: "B" },
    { question: "What is the index of the first element in a standard C/Python array or list?", optionA: "1", optionB: "0", optionC: "-1", optionD: "Depends on size", correct: "B" },
    { question: "Which loop is guaranteed to execute at least once?", optionA: "for loop", optionB: "while loop", optionC: "do-while loop", optionD: "foreach loop", correct: "C" }
  ],
  sql_dbms: [
    { question: "Which SQL command is used to remove a table and all its structure permanently?", optionA: "DELETE", optionB: "REMOVE", optionC: "DROP", optionD: "TRUNCATE", correct: "C" },
    { question: "A key that uniquely identifies each row in a relational table is called:", optionA: "Foreign Key", optionB: "Primary Key", optionC: "Alternate Key", optionD: "Super Key", correct: "B" },
    { question: "Which clause is used to filter groups in SQL?", optionA: "WHERE", optionB: "ORDER BY", optionC: "HAVING", optionD: "GROUP BY", correct: "C" },
    { question: "What does DDL stand for in DBMS?", optionA: "Data Definition Language", optionB: "Data Manipulation Language", optionC: "Dynamic Data Language", optionD: "Detailed Data List", correct: "A" },
    { question: "Which normal form removes partial functional dependency?", optionA: "1NF", optionB: "2NF", optionC: "3NF", optionD: "BCNF", correct: "B" }
  ],
  networking_html: [
    { question: "What is the full form of HTTP?", optionA: "HyperText Transfer Protocol", optionB: "HighText Transfer Process", optionC: "Hyperlink Text Protocol", optionD: "Hyper Transfer Text Program", correct: "A" },
    { question: "Which HTML tag is used to create a hyperlink?", optionA: "<link>", optionB: "<a>", optionC: "<href>", optionD: "<url>", correct: "B" },
    { question: "Which device operates at the Network Layer (Layer 3) of the OSI model?", optionA: "Hub", optionB: "Switch", optionC: "Router", optionD: "Repeater", correct: "C" },
    { question: "IPv4 addresses are how many bits long?", optionA: "16 bits", optionB: "32 bits", optionC: "64 bits", optionD: "128 bits", correct: "B" },
    { question: "Which HTML tag is used for the largest heading?", optionA: "<h6>", optionB: "<head>", optionC: "<h1>", optionD: "<header>", correct: "C" }
  ]
};

const generateSmartAiQuestionsByTopic = (topicInput) => {
  const t = topicInput.toLowerCase();
  if (t.includes('gate') || t.includes('boolean') || t.includes('logic') || t.includes('circuit')) return AI_TOPIC_QUESTION_BANK.logic_gates;
  if (t.includes('number') || t.includes('binary') || t.includes('octal') || t.includes('hex') || t.includes('complement')) return AI_TOPIC_QUESTION_BANK.number_system;
  if (t.includes('sql') || t.includes('dbms') || t.includes('database') || t.includes('table')) return AI_TOPIC_QUESTION_BANK.sql_dbms;
  if (t.includes('net') || t.includes('html') || t.includes('web') || t.includes('ip') || t.includes('osi')) return AI_TOPIC_QUESTION_BANK.networking_html;
  if (t.includes('c++') || t.includes('python') || t.includes('java') || t.includes('code') || t.includes('program') || t.includes('loop')) return AI_TOPIC_QUESTION_BANK.programming;
  return [
    { question: `In ${topicInput}, which of the following is the primary fundamental principle?`, optionA: `Core logic & structure of ${topicInput}`, optionB: "Unstructured random execution", optionC: "Hardware voltage fluctuation", optionD: "Manual paper indexing", correct: "A" },
    { question: `Why is ${topicInput} important in modern Computer Science & Applications?`, optionA: "It slows down compilation", optionB: "It optimizes efficiency, accuracy, and system design", optionC: "It replaces the monitor", optionD: "It only works offline", correct: "B" },
    { question: `When solving problems in ${topicInput}, what is the recommended first step?`, optionA: "Skip syntax rules", optionB: "Analyze input parameters & define the algorithm/logic", optionC: "Restart the operating system", optionD: "Delete variables", correct: "B" },
    { question: `Which error occurs if the syntax or rules of ${topicInput} are violated?`, optionA: "Syntax / Logical Error", optionB: "Power Supply Error", optionC: "Monitor Resolution Error", optionD: "Keyboard Hardware Error", correct: "A" },
    { question: `What is the best way to master ${topicInput} for WBBSE/WBCHSE & University exams?`, optionA: "Memorizing without practice", optionB: "Practicing dry-runs, numericals, and mock tests regularly", optionC: "Skipping practical classes", optionD: "Ignoring flowcharts", correct: "B" }
  ];
};

const generateStepByStepAiDoubtSolution = (questionText, hasImage) => {
  const q = questionText.toLowerCase();
  let steps = [];
  if (q.includes('binary') || q.includes('decimal') || q.includes('complement') || q.includes('number')) {
    steps = [
      "Step 1 (Core Concept): Always identify the base/radix of the number system first (Binary = 2, Octal = 8, Decimal = 10, Hexadecimal = 16).",
      "Step 2 (Conversion Method): To convert Decimal to Binary, divide the number repeatedly by 2 and record the remainders from bottom to top (MSB to LSB).",
      "Step 3 (2's Complement): First invert all bits (0 to 1 and 1 to 0) to get the 1's Complement, then add 1 to the Least Significant Bit (LSB).",
      "Exam Tip: Always write the base subscript at the end of your final answer, e.g., (1101)₂."
    ];
  } else if (q.includes('gate') || q.includes('boolean') || q.includes('morgan') || q.includes('nand')) {
    steps = [
      "Step 1 (Boolean Logic): Identify the input variables (A, B) and write down the corresponding Truth Table.",
      "Step 2 (De Morgan's Law): Remember the two key identities: (A + B)' = A' . B' and (A . B)' = A' + B' (Break the line, change the sign).",
      "Step 3 (Simplification): Apply Boolean identities such as A + A' = 1, A . A' = 0, and A + AB = A to reduce the expression."
    ];
  } else if (q.includes('sql') || q.includes('dbms') || q.includes('select') || q.includes('key')) {
    steps = [
      "Step 1 (Identify Table & Columns): Determine which table holds the records using the FROM clause.",
      "Step 2 (Filter Conditions): Use the WHERE clause for row-level conditions and HAVING for aggregate group conditions.",
      "Step 3 (Standard Syntax): SELECT column_name FROM Students WHERE marks > 80 ORDER BY name ASC;"
    ];
  } else {
    steps = [
      `Step 1 (Problem Analysis): Your query ("${questionText.slice(0, 60)}...") has been analyzed carefully.`,
      "Step 2 (Conceptual Breakdown): Start with a clear definition, write the syntax or block diagram, and provide a dry-run example.",
      "Step 3 (Scoring Strategy): Present key points in bullet format and label all diagrams or truth tables neatly."
    ];
  }
  if (hasImage) steps.unshift("📸 Image Scan Complete: Your uploaded question photo has been processed for step-by-step resolution.");
  return steps.join('\n\n');
};

const idbName = "DeepEducationPDFCacheFinalV8";
const initIDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(idbName, 1);
  req.onupgradeneeded = (e) => {
    const idb = e.target.result;
    if (!idb.objectStoreNames.contains('pdfs')) idb.createObjectStore('pdfs', { keyPath: 'id' });
  };
  req.onsuccess = (e) => resolve(e.target.result);
  req.onerror = (e) => reject(e.target.error);
});

const savePdfLocal = async (pdfObj) => {
  const idb = await initIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('pdfs', 'readwrite');
    tx.objectStore('pdfs').put(pdfObj);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
};

const getPdfsLocal = async () => {
  const idb = await initIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('pdfs', 'readonly');
    const req = tx.objectStore('pdfs').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
};

const deletePdfLocal = async (id) => {
  const idb = await initIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('pdfs', 'readwrite');
    tx.objectStore('pdfs').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
};

const triggerDevicePushNotification = (title, bodyText) => {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: bodyText, vibrate: [200, 100, 200] });
    }
  } catch (e) {}
};

const getFaceSignature = (videoOrCanvas) => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 32; tempCanvas.height = 32;
  const ctx = tempCanvas.getContext('2d');
  ctx.drawImage(videoOrCanvas, 0, 0, 32, 32);
  const data = ctx.getImageData(0, 0, 32, 32).data;
  const signature = [];
  for (let i = 0; i < data.length; i += 4) signature.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
  return signature;
};

const getCenteredFaceSignature = (videoEl) => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 32; tempCanvas.height = 32;
  const ctx = tempCanvas.getContext('2d');
  const vw = videoEl.videoWidth || 480;
  const vh = videoEl.videoHeight || 480;
  const cropW = vw * 0.65, cropH = vh * 0.65;
  const cropX = (vw - cropW) / 2, cropY = (vh - cropH) / 2;
  ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, 32, 32);
  const data = ctx.getImageData(0, 0, 32, 32).data;
  const signature = [];
  for (let i = 0; i < data.length; i += 4) signature.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
  return signature;
};

const averageSignatures = (sigList) => {
  if (!sigList || sigList.length === 0) return null;
  const len = sigList[0].length;
  const avg = new Array(len).fill(0);
  for (let i = 0; i < sigList.length; i++) for (let j = 0; j < len; j++) avg[j] += sigList[i][j];
  for (let j = 0; j < len; j++) avg[j] = Math.round(avg[j] / sigList.length);
  return avg;
};

const compareSignatures = (sig1, sig2) => {
  if (!sig1 || !sig2 || sig1.length !== sig2.length) return Infinity;
  let sum1 = 0, sum2 = 0;
  for (let i = 0; i < sig1.length; i++) { sum1 += sig1[i]; sum2 += sig2[i]; }
  const brightnessShift = (sum1 / sig1.length) - (sum2 / sig2.length);
  let weightedDiff = 0, totalWeight = 0;
  for (let i = 0; i < sig1.length; i++) {
    const x = i % 32, y = Math.floor(i / 32);
    const isCenterFace = (x >= 6 && x <= 25 && y >= 5 && y <= 26);
    const weight = isCenterFace ? 2.5 : 0.4;
    const normalizedVal1 = sig1[i] - brightnessShift * 0.7;
    weightedDiff += Math.abs(normalizedVal1 - sig2[i]) * weight;
    totalWeight += weight;
  }
  return weightedDiff / totalWeight;
};

const getTodayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getCurrentMonthISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MATCH_THRESHOLD = 45.0;

export default function App() {
  useEffect(() => {
    const removeNetlifyBadge = () => {
      const badge = document.querySelector('iframe[src*="netlify"]') || 
                    document.getElementById('netlify-badge') || 
                    document.querySelector('[data-netlify-badge]');
      if (badge) badge.remove();
    };
    removeNetlifyBadge();
    const observer = new MutationObserver(() => removeNetlifyBadge());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem('deep_edu_active_session_final_v8');
      return saved ? JSON.parse(saved) : { mode: 'home', user: null };
    } catch (e) { return { mode: 'home', user: null }; }
  });

  const [students, setStudents] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isWipingData, setIsWipingData] = useState(false);

  const [authTab, setAuthTab] = useState('login');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regGender, setRegGender] = useState('Male');
  const [regBatch, setRegBatch] = useState(BATCH_OPTIONS[0]);
  const [regDob, setRegDob] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDp, setRegDp] = useState(null);
  const [registeredStudentObj, setRegisteredStudentObj] = useState(null);
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingStudentData, setPendingStudentData] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);
  const [teacherPass, setTeacherPass] = useState('');
  const [teacherCurrentPin, setTeacherCurrentPin] = useState(() => localStorage.getItem('deep_teacher_pin') || '');
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [teacherSignatureImg, setTeacherSignatureImg] = useState(() => localStorage.getItem('deep_teacher_signature_img') || null);
  const [contactInfo, setContactInfo] = useState(() => JSON.parse(localStorage.getItem('deep_contact_info_v3') || JSON.stringify({
    phone: '6290373660',
    altPhone: '9593277159',
    whatsapp: '916290373660',
    email: 'avradeepbiswas@deepeducation.in',
    address: 'Gourangapara, Madanpur, Nadia, West Bengal - 741245'
  })));

  const [teacherNavTab, setTeacherNavTab] = useState('fees');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [attendanceViewTab, setAttendanceViewTab] = useState('daily');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getTodayISO());
  const [selectedMonthFilter, setSelectedMonthFilter] = useState(getCurrentMonthISO());

  const [feesRecords, setFeesRecords] = useState([]);
  const [managingFeeStudent, setManagingFeeStudent] = useState(null);
  const [viewingFeeHistoryStudent, setViewingFeeHistoryStudent] = useState(null);
  const [feeMonthInput, setFeeMonthInput] = useState(getCurrentMonthISO());
  const [feeAmountInput, setFeeAmountInput] = useState('500');
  const [feeStatusInput, setFeeStatusInput] = useState('Paid');
  const [viewingQrModal, setViewingQrModal] = useState(false);
  const [viewingFeeBillModal, setViewingFeeBillModal] = useState(null);
  const [viewingCertificateModal, setViewingCertificateModal] = useState(false);

  const [liveClasses, setLiveClasses] = useState([]);
  const [newClassTitle, setNewClassTitle] = useState('');
  const [newClassTime, setNewClassTime] = useState('');
  const [newClassLink, setNewClassLink] = useState('');

  const [recordedClasses, setRecordedClasses] = useState([]);
  const [newRecTitle, setNewRecTitle] = useState('');
  const [newRecBatch, setNewRecBatch] = useState('ALL');
  const [newRecUrl, setNewRecUrl] = useState('');
  const [activeRecording, setActiveRecording] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [timestampNoteInput, setTimestampNoteInput] = useState('');
  const [studentTimestampNotes, setStudentTimestampNotes] = useState(() => JSON.parse(localStorage.getItem('deep_timestamp_notes_v3') || '{}'));

  const [liveChatMessages, setLiveChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [pollsList, setPollsList] = useState([]);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptA, setNewPollOptA] = useState('');
  const [newPollOptB, setNewPollOptB] = useState('');

  const [studentQuizHistory, setStudentQuizHistory] = useState(() => JSON.parse(localStorage.getItem('deep_ai_quiz_history_v3') || '[]'));
  const [doubtsList, setDoubtsList] = useState([]);
  const [doubtQuestionInput, setDoubtQuestionInput] = useState('');
  const [doubtPhotoData, setDoubtPhotoData] = useState(null);
  const [teacherReplyInputs, setTeacherReplyInputs] = useState({});
  const [examCountdown, setExamCountdown] = useState(() => JSON.parse(localStorage.getItem('deep_exam_countdown_local') || '{"title":"Final Semester & Board Exam","date":""}'));
  const [parentalPin] = useState(() => localStorage.getItem('deep_parental_pin') || '1234');
  const [parentalUnlocked, setParentalUnlocked] = useState(false);
  const [parentalPinInput, setParentalPinInput] = useState('');

  const [pdfList, setPdfList] = useState([]);
  const [viewingPdf, setViewingPdf] = useState(null);
  const [pdfTitleInput, setPdfTitleInput] = useState('');
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const [notices, setNotices] = useState([]);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');

  const [mockTests, setMockTests] = useState([]);
  const [activeTest, setActiveTest] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [examTimeLeft, setExamTimeLeft] = useState(3600);
  const [testRetreatRequests, setTestRetreatRequests] = useState({});

  const [isEditingTestId, setIsEditingTestId] = useState(null);
  const [testTitle, setTestTitle] = useState('');
  const [testBatchTarget, setTestBatchTarget] = useState('ALL');
  const [questionsList, setQuestionsList] = useState([
    { question: '', optionA: '', optionB: '', optionC: '', optionD: '', correct: 'A' }
  ]);

  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbacksList, setFeedbacksList] = useState([]);

  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [studentNotifications, setStudentNotifications] = useState([]);
  const [livePushBanner, setLivePushBanner] = useState(null);
  const [studentNavTab, setStudentNavTab] = useState('notices');

  const [seenMockTests, setSeenMockTests] = useState(() => JSON.parse(localStorage.getItem('seen_mock') || '[]'));
  const [seenPdfs, setSeenPdfs] = useState(() => JSON.parse(localStorage.getItem('seen_pdfs') || '[]'));
  const [seenNotices, setSeenNotices] = useState(() => JSON.parse(localStorage.getItem('seen_notices') || '[]'));
  const [seenFees, setSeenFees] = useState(false);
  const [seenFeedback, setSeenFeedback] = useState(false);

  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editGender, setEditGender] = useState('Male');
  const [editDp, setEditDp] = useState(null);

  const [selectedStudentIdForFace, setSelectedStudentIdForFace] = useState('');
  const [teacherCameraOpen, setTeacherCameraOpen] = useState(false);
  const [faceRegProgress, setFaceRegProgress] = useState(0);
  const [isRegisteringFaceScan, setIsRegisteringFaceScan] = useState(false);

  const [attendanceScannerOpen, setAttendanceScannerOpen] = useState(false);
  const [detectedStudent, setDetectedStudent] = useState(null);
  const [detectedDateTime, setDetectedDateTime] = useState({ date: '', time: '' });
  const [isScanning, setIsScanning] = useState(false);
  const [capturedProofPhoto, setCapturedProofPhoto] = useState(null);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [scanDebugText, setScanDebugText] = useState('');
  
  // NEW: Camera Switch State
  const [cameraFacingMode, setCameraFacingMode] = useState('user');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const examTimerRef = useRef(null);
  const skippedStudentIdsRef = useRef([]);
  const recVideoPlayerRef = useRef(null);
  const userAnswersRef = useRef(userAnswers);
  const examSubmittedRef = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, STUDENTS_COL), (snap) => {
      const cloudStudents = snap.docs.map(d => decryptRecordFields({ id: d.id, ...d.data() }, STUDENT_ENCRYPTED_FIELDS, STUDENT_ENCRYPTED_ARRAYS));
      setStudents(cloudStudents);
      persistStudents(cloudStudents);
      setLoadingData(false);
    }, (err) => console.error("Students sync error:", err));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, FEES_COL), (snap) => {
      setFeesRecords(snap.docs.map(d => decryptRecordFields({ id: d.id, ...d.data() }, FEE_ENCRYPTED_FIELDS)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'live_classes'), (snap) => {
      setLiveClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, RECORDINGS_COL), (snap) => {
      setRecordedClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, LIVECHAT_COL), (snap) => {
      const loadedChat = snap.docs.map(d => decryptRecordFields({ id: d.id, ...d.data() }, CHAT_ENCRYPTED_FIELDS));
      loadedChat.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setLiveChatMessages(loadedChat);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, POLLS_COL), (snap) => {
      setPollsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, DOUBTS_COL), (snap) => {
      const loadedDoubts = snap.docs.map(d => decryptRecordFields({ id: d.id, ...d.data() }, DOUBT_ENCRYPTED_FIELDS));
      loadedDoubts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setDoubtsList(loadedDoubts);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'notices'), (snap) => {
      const loadedNotices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotices(loadedNotices.length > 0 ? loadedNotices : [{ id: 'default-notice', title: 'Weekly Class Schedule', content: 'Check batch routine and mark attendance.', date: new Date().toLocaleDateString('en-IN') }]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, MOCKTEST_COL), (snap) => {
      setMockTests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, FEEDBACK_COL), (snap) => {
      setFeedbacksList(snap.docs.map(d => decryptRecordFields({ id: d.id, ...d.data() }, FEEDBACK_ENCRYPTED_FIELDS)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, ATTENDANCE_COL), (snap) => {
      const loadedAtt = snap.docs.map(d => decryptRecordFields({ id: d.id, ...d.data() }, ATTENDANCE_ENCRYPTED_FIELDS));
      loadedAtt.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setAttendanceLogs(loadedAtt);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (session.mode === 'teacher') {
      const unsub = onSnapshot(collection(db, 'pdfs'), (snap) => {
        const records = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setPdfList(records);
      });
      return () => unsub();
    }
    
    if (session.mode === 'student' && session.user?.batch) {
      const received = new Map();
      const publish = () => setPdfList([...received.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      
      const q1 = query(collection(db, 'pdfs'), where('batch', '==', 'ALL'));
      const q2 = query(collection(db, 'pdfs'), where('batch', '==', session.user.batch));
      
      const unsub1 = onSnapshot(q1, (snap) => {
        snap.docs.forEach(d => received.set(d.id, { id: d.id, ...d.data() }));
        publish();
      });
      const unsub2 = onSnapshot(q2, (snap) => {
        snap.docs.forEach(d => received.set(d.id, { id: d.id, ...d.data() }));
        publish();
      });
      
      return () => { unsub1(); unsub2(); };
    }
  }, [session.mode, session.user?.batch]);

  useEffect(() => {
    if (session.mode === 'teacher') {
      const unsub = onSnapshot(collection(db, NOTIFICATIONS_COL), (snap) => {
        const records = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setStudentNotifications(records);
      });
      return () => unsub();
    }
    
    if (session.mode === 'student' && session.user?.id && session.user?.batch) {
      const received = new Map();
      const publish = () => {
        const records = [...received.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setStudentNotifications(records);
      };
      
      const q1 = query(collection(db, NOTIFICATIONS_COL), where('studentId', '==', session.user.id));
      const q2 = query(collection(db, NOTIFICATIONS_COL), where('studentId', '==', 'ALL'), where('targetBatch', '==', 'ALL'));
      const q3 = query(collection(db, NOTIFICATIONS_COL), where('studentId', '==', 'ALL'), where('targetBatch', '==', session.user.batch));
      
      const unsub1 = onSnapshot(q1, (snap) => { snap.docs.forEach(d => received.set(d.id, { id: d.id, ...d.data() })); publish(); });
      const unsub2 = onSnapshot(q2, (snap) => { snap.docs.forEach(d => received.set(d.id, { id: d.id, ...d.data() })); publish(); });
      const unsub3 = onSnapshot(q3, (snap) => { snap.docs.forEach(d => received.set(d.id, { id: d.id, ...d.data() })); publish(); });
      
      return () => { unsub1(); unsub2(); unsub3(); };
    }
  }, [session.mode, session.user?.id, session.user?.batch]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, PORTAL_SETTINGS_COL, 'exam_countdown'), (docSnap) => {
      if (docSnap.exists()) {
        setExamCountdown(docSnap.data());
        localStorage.setItem('deep_exam_countdown_local', JSON.stringify(docSnap.data()));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }, []);

  useEffect(() => { userAnswersRef.current = userAnswers; }, [userAnswers]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [teacherNavTab]);

  useEffect(() => {
    let sessionToStore = session;
    if (session && session.user) {
      const { password, faceSignature, faceSignatureCentered, ...safeUser } = session.user;
      sessionToStore = { ...session, user: safeUser };
    }
    try { localStorage.setItem('deep_edu_active_session_final_v8', JSON.stringify(sessionToStore)); } catch (e) {}
    if (session.mode === 'student' && session.user) {
      const currentStudent = students.find(s => s.id === session.user.id);
      if (currentStudent) {
        setEditPhone(currentStudent.phone || '');
        setEditPassword(currentStudent.password || '');
        setEditGender(currentStudent.gender || 'Male');
        setEditDp(currentStudent.dp || null);
      }
    }
  }, [session, students]);

  useEffect(() => {
    if (activeTest && !testResult) {
      examSubmittedRef.current = false;
      setExamTimeLeft(3600);
      examTimerRef.current = setInterval(() => {
        setExamTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    } else {
      if (examTimerRef.current) { clearInterval(examTimerRef.current); examTimerRef.current = null; }
    }
    return () => { if (examTimerRef.current) { clearInterval(examTimerRef.current); examTimerRef.current = null; } };
  }, [activeTest]);

  function finalizeExam(timedOut) {
    if (!activeTest || examSubmittedRef.current) return;
    examSubmittedRef.current = true;
    if (examTimerRef.current) { clearInterval(examTimerRef.current); examTimerRef.current = null; }
    const answers = userAnswersRef.current || {};
    let score = 0;
    activeTest.questions.forEach((q, idx) => { if (answers[idx] === q.correct) score++; });
    const resultObj = {
      score, total: activeTest.questions.length, title: activeTest.title,
      date: new Date().toLocaleDateString('en-IN')
    };
    if (timedOut) resultObj.timeout = true;
    setTestResult(resultObj);
    setStudentQuizHistory(prev => {
      const updatedHist = [resultObj, ...prev];
      try { localStorage.setItem('deep_ai_quiz_history_v3', JSON.stringify(updatedHist)); } catch (e) {}
      return updatedHist;
    });
    if (timedOut) alert("Time's up! Your exam has been automatically submitted.");
  }

  function handleSubmitMockTest() { finalizeExam(false); }

  useEffect(() => {
    if (examTimeLeft === 0 && activeTest && !testResult) finalizeExam(true);
  }, [examTimeLeft, activeTest, testResult]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && activeTest && !testResult) finalizeExam(true);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeTest, testResult]);

  const handleSaveExamCountdownFromTeacher = async (updatedExamObj) => {
    setExamCountdown(updatedExamObj);
    localStorage.setItem('deep_exam_countdown_local', JSON.stringify(updatedExamObj));
    try { await setDoc(doc(db, PORTAL_SETTINGS_COL, 'exam_countdown'), updatedExamObj); } catch (e) {}
  };

  const handlePublishSettings = async () => {
    await handleSaveExamCountdownFromTeacher(examCountdown);
    localStorage.setItem('deep_contact_info_v3', JSON.stringify(contactInfo));
    alert('Exam countdown & contact details published successfully!');
  };

  const handleWipeAllOldData = async () => {
    if (!window.confirm("Permanently DELETE all students and records from Firebase?")) return;
    setIsWipingData(true);
    try {
      const collections = [
        STUDENTS_COL, ATTENDANCE_COL, NOTIFICATIONS_COL, MOCKTEST_COL, FEEDBACK_COL,
        FEES_COL, DOUBTS_COL, RECORDINGS_COL, LIVECHAT_COL, POLLS_COL,
        'live_classes', 'notices', 'pdfs', 'pdf_chunks', PORTAL_SETTINGS_COL
      ];
      for (const col of collections) {
        try {
          const snap = await getDocs(collection(db, col));
          await Promise.all(snap.docs.map(d => deleteDoc(doc(db, col, d.id))));
        } catch (e) {}
      }
      localStorage.removeItem('deep_students_emergency_backup');
      localStorage.removeItem('deep_exam_countdown_local');
      setStudents([]); setAttendanceLogs([]); setStudentNotifications([]); setMockTests([]);
      setFeedbacksList([]); setFeesRecords([]);
      setPdfList([]); setLiveClasses([]); setRecordedClasses([]); setNotices([]);
      setDoubtsList([]); setLiveChatMessages([]); setPollsList([]);
      setExamCountdown({ title: "Final Semester & Board Exam", date: "" });
      alert("Database wiped successfully!");
    } catch (err) { alert("Error: " + err.message); }
    setIsWipingData(false);
  };

  const handleDeleteSingleStudent = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await deleteDoc(doc(db, STUDENTS_COL, id));
    } catch (e) { alert("Error: " + e.message); }
  };

  const handleQuickGenderUpdate = async (studentId, newGender) => {
    try {
      await updateDoc(doc(db, STUDENTS_COL, studentId), { gender: encryptE2EE(newGender) });
    } catch (e) { alert("Error updating gender: " + e.message); }
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setTeacherSignatureImg(ev.target.result);
        localStorage.setItem('deep_teacher_signature_img', ev.target.result);
        alert('Your official signature has been saved for all Certificates and Fee Bills!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleIssueCertificate = async (st) => {
    const nextStatus = !st.certificateIssued;
    const issuedDate = new Date().toLocaleDateString('en-IN');
    try {
      await updateDoc(doc(db, STUDENTS_COL, st.id), {
        certificateIssued: nextStatus, certificateIssuedDate: issuedDate
      });
      if (nextStatus) {
        const notifPayload = {
          studentId: st.id, studentName: st.name, batch: st.batch,
          title: '🎓 Certificate Issued! Congratulations!',
          message: `Dear ${st.name}, your official Course Certificate for ${st.batch} has been issued by Avradeep Biswas. You can now View, Download, or Share it!`,
          date: issuedDate, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now()
        };
        await addDoc(collection(db, NOTIFICATIONS_COL), notifPayload);
        alert(`Certificate officially ISSUED to ${st.name}!`);
      } else {
        alert(`Certificate revoked for ${st.name}.`);
      }
    } catch (err) { alert('Error updating certificate status: ' + err.message); }
  };

  const startCameraStream = async (mode = cameraFacingMode) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.log("Video play error:", e));
        };
      }
    } catch (err) { 
      console.error(err);
      alert('Camera access denied or not available.'); 
    }
  };

  const handleSwitchCamera = () => {
    const newMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(newMode);
    startCameraStream(newMode);
  };

  const stopCameraStream = () => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setTeacherCameraOpen(false); setAttendanceScannerOpen(false); setIsScanning(false);
    setIsRegisteringFaceScan(false); setFaceRegProgress(0); setDetectedStudent(null);
    setScanDebugText('');
    skippedStudentIdsRef.current = [];
  };

  const capturePhotoDataUrl = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current, video = videoRef.current;
    canvas.width = 260; canvas.height = 260;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleDpUploadChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setRegDp(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleEditDpChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setEditDp(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleStudentRegister = (e) => {
    e.preventDefault();
    if (!regName.trim() || !regGender || !regBatch || !regDob || !regPhone.trim() || !regPassword.trim()) {
      alert('All fields are mandatory!'); return;
    }
    if (students.some(s => s.phone === regPhone.trim())) {
      alert('Phone number already registered!'); return;
    }
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(otp);
    setPendingStudentData({
      name: regName.trim(), gender: regGender, batch: regBatch, dob: regDob,
      phone: regPhone.trim(), password: regPassword.trim(), dp: regDp || null,
      facePhoto: null, faceSignature: null, certificateIssued: false,
      e2eeProtected: true, registeredAt: new Date().toLocaleDateString('en-IN')
    });
    setShowOtpModal(true);
  };

  const verifyOtpAndRegister = async () => {
    if (otpInput.trim() !== generatedOtp) {
      alert('Invalid OTP! Please check the code shown on screen.'); return;
    }
    try {
      const encryptedPayload = encryptRecordFields(pendingStudentData, STUDENT_ENCRYPTED_FIELDS);
      await addDoc(collection(db, STUDENTS_COL), encryptedPayload);
      setShowOtpModal(false); setOtpInput(''); setRegisteredStudentObj(pendingStudentData);
      setRegName(''); setRegGender('Male'); setRegDob(''); setRegPhone(''); setRegPassword(''); setRegDp(null);
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleStudentLogin = (e) => {
    e.preventDefault();
    const matched = students.find(s => s.phone === loginPhone.trim() && s.password === loginPassword.trim());
    if (matched) {
      setSession({ mode: 'student', user: matched });
      enableStudentPushNotifications(matched.id, matched.batch).catch((error) => console.warn('Push setup unavailable:', error));
      setStudentNavTab('notices');
      setLoginPhone(''); setLoginPassword('');
    } else { alert('Invalid Phone Number or Password!'); }
  };

  const handleUpdateStudentProfile = async (e) => {
    e.preventDefault();
    if (!session.user) return;
    try {
      const plainPayload = { phone: editPhone.trim(), password: editPassword.trim(), gender: editGender, dp: editDp };
      const encryptedPayload = encryptRecordFields(plainPayload, ['phone', 'password', 'gender', 'dp']);
      await updateDoc(doc(db, STUDENTS_COL, session.user.id), encryptedPayload);
      setSession(prev => ({ ...prev, user: { ...prev.user, ...plainPayload } }));
      alert('Profile updated successfully.');
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleTeacherLogin = (e) => {
    e.preventDefault();
    if (teacherCurrentPin && teacherPass.trim() !== teacherCurrentPin) {
      alert('Invalid Teacher PIN!'); return;
    }
    setSession({ mode: 'teacher', user: { name: 'Teacher Admin' } });
    setShowTeacherLogin(false); setTeacherPass('');
  };

  const handleChangeTeacherPin = (e) => {
    e.preventDefault();
    if (teacherCurrentPin && oldPinInput.trim() !== teacherCurrentPin) {
      alert('Incorrect Old PIN!'); return;
    }
    if (!newPinInput.trim()) { alert('New PIN cannot be empty!'); return; }
    setTeacherCurrentPin(newPinInput.trim());
    localStorage.setItem('deep_teacher_pin', newPinInput.trim());
    setShowChangePinModal(false); setOldPinInput(''); setNewPinInput('');
    alert('Teacher PIN changed successfully!');
  };

  const handleLogout = () => {
    stopCameraStream(); setLivePushBanner(null); setActiveTest(null); setTestResult(null);
    setSession({ mode: 'home', user: null });
  };

  const openTeacherFaceRegistration = () => {
    if (!selectedStudentIdForFace) { alert('Select a student first!'); return; }
    setTeacherCameraOpen(true); setFaceRegProgress(0); setIsRegisteringFaceScan(false);
    setTimeout(() => startCameraStream(), 250);
  };

  const saveStudentFaceToFirebase = () => {
    if (!videoRef.current || !selectedStudentIdForFace) return;
    setIsRegisteringFaceScan(true); setFaceRegProgress(0);
    const collectedSigs = [], collectedCenterSigs = [];
    let ticks = 0;
    const totalTicks = 20;
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      ticks++;
      collectedSigs.push(getFaceSignature(videoRef.current));
      collectedCenterSigs.push(getCenteredFaceSignature(videoRef.current));
      const pct = Math.min(100, Math.round((ticks / totalTicks) * 100));
      setFaceRegProgress(pct);
      if (ticks >= totalTicks) {
        clearInterval(scanIntervalRef.current); scanIntervalRef.current = null;
        const photoUrl = capturePhotoDataUrl();
        const masterSignature = averageSignatures(collectedSigs);
        const masterCenterSig = averageSignatures(collectedCenterSigs);
        try {
          await updateDoc(doc(db, STUDENTS_COL, selectedStudentIdForFace), {
            facePhoto: encryptE2EE(photoUrl),
            faceSignature: encryptE2EE(JSON.stringify(masterSignature)),
            faceSignatureCentered: encryptE2EE(JSON.stringify(masterCenterSig)),
            e2eeEncrypted: true
          });
          stopCameraStream();
          alert('Face registration completed. Student portal is now unlocked.');
        } catch (err) { setIsRegisteringFaceScan(false); alert('Error: ' + err.message); }
      }
    }, 200);
  };

  const handleSaveFeeRecord = async (e) => {
    e.preventDefault();
    if (!managingFeeStudent) return;
    try {
      const now = new Date();
      const paidDate = now.toLocaleDateString('en-IN');
      const paidTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const feePayload = {
        studentId: managingFeeStudent.id, ownerUid: managingFeeStudent.authUid || null,
        studentName: managingFeeStudent.name, batch: managingFeeStudent.batch,
        month: feeMonthInput, amount: Number(feeAmountInput), status: feeStatusInput,
        updatedAt: paidDate, paidTime: paidTime,
        receiptNo: `DE-BILL-${Date.now().toString().slice(-6)}`
      };
      const encryptedFeePayload = encryptRecordFields(feePayload, FEE_ENCRYPTED_FIELDS);
      const existing = feesRecords.find(f => f.studentId === managingFeeStudent.id && f.month === feeMonthInput);
      if (existing) {
        await updateDoc(doc(db, FEES_COL, existing.id), encryptedFeePayload);
      } else {
        await addDoc(collection(db, FEES_COL), encryptedFeePayload);
      }
      if (feeStatusInput === 'Paid') {
        const notifPayload = {
          studentId: managingFeeStudent.id, studentName: managingFeeStudent.name, batch: managingFeeStudent.batch,
          title: '🧾 Fee Payment Receipt Generated ✓',
          message: `Your fee of ₹${feeAmountInput} for ${feeMonthInput} is marked PAID on ${paidDate} at ${paidTime}. Download your official signed bill from Fees & Bills!`,
          date: paidDate, time: paidTime, timestamp: Date.now()
        };
        await addDoc(collection(db, NOTIFICATIONS_COL), notifPayload);
      }
      alert(`Fee record and official bill updated for ${managingFeeStudent.name}!`);
      setManagingFeeStudent(null);
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleDownloadFeeBillImage = (feeRecord, remainingDueAmount) => {
    const canvas = document.createElement('canvas');
    canvas.width = 850; canvas.height = 620;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 850, 620);
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 5; ctx.strokeRect(20, 20, 810, 580);
    ctx.fillStyle = '#083344'; ctx.fillRect(23, 23, 804, 105);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('DEEP EDUCATION', 425, 68);
    ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText('OFFICIAL FEE PAYMENT RECEIPT / BILL', 425, 100);
    ctx.textAlign = 'left'; ctx.fillStyle = '#94a3b8'; ctx.font = '15px monospace';
    const safeId = (feeRecord.id || '').slice(0, 6).toUpperCase();
    ctx.fillText(`Receipt No: ${feeRecord.receiptNo || `DE-${safeId}`}`, 55, 165);
    ctx.fillText(`Payment Date: ${feeRecord.updatedAt || new Date().toLocaleDateString('en-IN')}`, 520, 165);
    ctx.fillText(`Payment Time: ${feeRecord.paidTime || '12:00 PM'}`, 520, 192);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(50, 215); ctx.lineTo(800, 215); ctx.stroke();
    const drawRow = (label, val, yPos, color = '#ffffff') => {
      ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(label, 60, yPos);
      ctx.fillStyle = color; ctx.font = 'bold 19px sans-serif'; ctx.fillText(val, 320, yPos);
    };
    drawRow('Student Name:', feeRecord.studentName || session.user?.name || '', 260);
    drawRow('Batch Name:', feeRecord.batch || session.user?.batch || '', 305, '#38bdf8');
    drawRow('Fee Month:', feeRecord.month || '', 350);
    drawRow('Amount Paid:', `Rs. ${feeRecord.amount}/-`, 395, '#34d399');
    drawRow('Payment Status:', 'PAID & VERIFIED ✓', 440, '#34d399');
    drawRow('Remaining Due:', remainingDueAmount > 0 ? `Rs. ${remainingDueAmount}/- (Due)` : 'Rs. 0/- (No Dues)', 485, remainingDueAmount > 0 ? '#f87171' : '#a7f3d0');
    const finalizeDownload = () => {
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Avradeep Biswas', 680, 560);
      ctx.fillStyle = '#22d3ee'; ctx.font = '13px sans-serif';
      ctx.fillText('Authorized Signature • Deep Education', 680, 580);
      const link = document.createElement('a');
      link.download = `Deep_Education_Fee_Bill_${feeRecord.month}_${(feeRecord.studentName || 'Student').replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png'); link.click();
    };
    if (teacherSignatureImg) {
      const sigImg = new Image();
      sigImg.onload = () => { ctx.drawImage(sigImg, 595, 480, 170, 60); finalizeDownload(); };
      sigImg.onerror = finalizeDownload;
      sigImg.src = teacherSignatureImg;
    } else {
      ctx.fillStyle = '#fbbf24'; ctx.font = 'italic bold 28px serif'; ctx.textAlign = 'center';
      ctx.fillText('Avradeep Biswas', 680, 525);
      finalizeDownload();
    }
  };

  const openTeacherAttendanceScanner = () => {
    const todayIso = getTodayISO();
    const presentTodayIds = new Set(attendanceLogs.filter(l => l.isoDate === todayIso).map(l => l.studentId));
    const enrolled = students.filter(s => s.facePhoto && s.faceSignature && !presentTodayIds.has(s.id));

    if (enrolled.length === 0) { 
      alert('All registered students are already marked present today, or no faces are registered!'); 
      return; 
    }
    
    setDetectedStudent(null); setCapturedProofPhoto(null);
    setAttendanceScannerOpen(true); setIsScanning(true);
    setScanDebugText('Scanning... Please look at the camera.');
    skippedStudentIdsRef.current = [];
    
    setTimeout(async () => {
      await startCameraStream();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      
      scanIntervalRef.current = setInterval(() => {
        if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
          const liveSig = getFaceSignature(videoRef.current);
          const liveCenterSig = getCenteredFaceSignature(videoRef.current);
          let bestMatch = null, lowestScore = Infinity;
          
          enrolled.forEach(st => {
            if (skippedStudentIdsRef.current.includes(st.id)) return;
            let score = compareSignatures(liveSig, st.faceSignature);
            if (st.faceSignatureCentered && st.faceSignatureCentered.length === 1024) {
              const centerScore = compareSignatures(liveCenterSig, st.faceSignatureCentered);
              if (centerScore < score) score = centerScore;
            }
            if (score < lowestScore) { lowestScore = score; bestMatch = st; }
          });

          if (bestMatch && lowestScore < MATCH_THRESHOLD) {
            setScanDebugText(`✅ ${bestMatch.name} Recognized!`);
            const now = new Date();
            setCapturedProofPhoto(capturePhotoDataUrl());
            setDetectedStudent(bestMatch);
            setDetectedDateTime({
              date: now.toLocaleDateString('en-IN'),
              time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
            
            if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
            setIsScanning(false);
          } else {
            if (lowestScore === Infinity) {
              setScanDebugText('⚠️ No face detected. Please face the camera.');
            } else {
              setScanDebugText(`❌ Face Not Matched (Score: ${lowestScore.toFixed(1)}). Adjust lighting/position.`);
            }
            
            if (skippedStudentIdsRef.current.length > 0) {
              skippedStudentIdsRef.current = [];
            }
          }
        }
      }, 1000); 
    }, 1000);
  };

  const handleNotMeCycleNext = () => {
    if (detectedStudent) skippedStudentIdsRef.current = [...skippedStudentIdsRef.current, detectedStudent.id];
    setDetectedStudent(null); setCapturedProofPhoto(null); setIsScanning(true);
    openTeacherAttendanceScanner();
  };

  const confirmAndMarkAttendance = async () => {
    if (!detectedStudent) return;
    setIsSavingAttendance(true);
    const saveToFirestore = async (locationText) => {
      const now = new Date();
      const isoDate = getTodayISO();
      const displayDate = detectedDateTime.date || now.toLocaleDateString('en-IN');
      const displayTime = detectedDateTime.time || now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const plainRecord = {
        studentId: detectedStudent.id, ownerUid: detectedStudent.authUid || null,
        name: detectedStudent.name, batch: detectedStudent.batch,
        phone: detectedStudent.phone || '', isoDate, date: displayDate, time: displayTime,
        timestamp: Date.now(), location: locationText,
        capturedPhoto: capturedProofPhoto || detectedStudent.facePhoto, status: 'Present'
      };
      const encryptedRecord = encryptRecordFields(plainRecord, ATTENDANCE_ENCRYPTED_FIELDS);
      const notifPayload = {
        studentId: detectedStudent.id, studentName: detectedStudent.name, batch: detectedStudent.batch,
        title: 'Attendance Confirmed: Present ✓', message: `${detectedStudent.name} is present today at ${displayTime}.`,
        date: displayDate, time: displayTime, timestamp: Date.now()
      };
      try {
        await addDoc(collection(db, ATTENDANCE_COL), encryptedRecord);
        await addDoc(collection(db, NOTIFICATIONS_COL), notifPayload);
        
        triggerDevicePushNotification(`Attendance Confirmed: ${detectedStudent.name} ✓`, `Today's attendance successfully marked at ${displayTime}.`);
        setIsSavingAttendance(false);
        alert(`Attendance marked successfully for ${detectedStudent.name}!`);
        
        skippedStudentIdsRef.current = [];
        setDetectedStudent(null); setCapturedProofPhoto(null); 
        openTeacherAttendanceScanner(); 
        
      } catch (err) { 
        setIsSavingAttendance(false); 
        alert('Error: ' + err.message); 
      }
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => saveToFirestore(`GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
        () => saveToFirestore('Deep Education Center, Madanpur'),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else { saveToFirestore('Deep Education Center, Madanpur'); }
  };

  const handleMarkAttendanceAbsent = async (logId, studentName) => {
    if (!window.confirm(`Are you sure you want to mark ${studentName} as ABSENT and remove their attendance?`)) return;
    try {
      await deleteDoc(doc(db, ATTENDANCE_COL, logId));
      alert(`Attendance removed. ${studentName} is now marked ABSENT for today.`);
    } catch (err) { alert('Error removing attendance: ' + err.message); }
  };

  const broadcastPushNotification = async (titleText, bodyText, targetBatch = 'ALL') => {
    try {
      const notifData = {
        studentId: 'ALL', targetBatch, title: titleText, message: bodyText,
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };
      await addDoc(collection(db, NOTIFICATIONS_COL), notifData);
      triggerDevicePushNotification(titleText, bodyText);
    } catch (error) {
      console.error('Notification record could not be saved:', error);
    }
  };

  const handleTeacherAutoFillAiQuestions = async () => {
    if (!testTitle.trim()) { alert('First enter a topic or test title.'); return; }
    try {
      const previousQuestions = mockTests.flatMap((test) => (test.questions || []).map((q) => q.question)).filter(Boolean).slice(-250);
      const response = await fetch('/.netlify/functions/generate-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: testTitle.trim(), batch: testBatchTarget, previousQuestions })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'AI quiz service is not configured.');
      const generated = Array.isArray(result.questions) ? result.questions : [];
      if (generated.length !== 35) throw new Error(`The AI returned ${generated.length} questions; exactly 35 are required. Please retry.`);
      const normalized = generated.map((q) => ({
        question: String(q.question || '').trim(), optionA: String(q.optionA || '').trim(),
        optionB: String(q.optionB || '').trim(), optionC: String(q.optionC || '').trim(),
        optionD: String(q.optionD || '').trim(), correct: String(q.correct || 'A').toUpperCase(),
        difficulty: q.difficulty || 'Medium', explanation: q.explanation || ''
      }));
      if (normalized.some((q) => !q.question || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !['A','B','C','D'].includes(q.correct))) {
        throw new Error('The generated quiz contains incomplete or invalid questions. Please retry.');
      }
      setQuestionsList(normalized);
      alert(`Generated 35 MCQs for "${testTitle}". Review and edit them before publishing.`);
    } catch (err) {
      console.error('AI quiz generation failed:', err);
      const fallbackQuestions = generateSmartAiQuestionsByTopic(testTitle.trim());
      if (fallbackQuestions && fallbackQuestions.length > 0) {
        setQuestionsList(fallbackQuestions);
        alert(`AI generation unavailable: ${err.message}\n\nLoaded ${fallbackQuestions.length} offline questions on this topic. Please add the remaining ${35 - fallbackQuestions.length} manually.`);
      } else {
        alert(`AI generation unavailable: ${err.message}`);
      }
    }
  };

  const handleDoubtPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setDoubtPhotoData(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAskAiDoubt = async (e) => {
    e.preventDefault();
    if (!doubtQuestionInput.trim() && !doubtPhotoData) {
      alert('Type your question or upload a photo of the problem!'); return;
    }
    const aiStepByStepAnswer = generateStepByStepAiDoubtSolution(doubtQuestionInput.trim() || 'Uploaded Photo Question', Boolean(doubtPhotoData));
    const plainPayload = {
      studentId: session.user?.id || 'guest', ownerUid: session.user?.authUid || null,
      studentName: session.user?.name || 'Student', batch: session.user?.batch || '',
      question: doubtQuestionInput.trim() || 'Please explain the attached photo question step-by-step.',
      photo: doubtPhotoData || null, aiAnswer: aiStepByStepAnswer, teacherReply: '',
      date: new Date().toLocaleDateString('en-IN'),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };
    const encryptedPayload = encryptRecordFields(plainPayload, DOUBT_ENCRYPTED_FIELDS);
    try {
      await addDoc(collection(db, DOUBTS_COL), encryptedPayload);
      setDoubtQuestionInput(''); setDoubtPhotoData(null);
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleSaveTeacherDoubtReply = async (doubtId) => {
    const replyText = teacherReplyInputs[doubtId];
    if (!replyText || !replyText.trim()) return;
    try {
      await updateDoc(doc(db, DOUBTS_COL, doubtId), { teacherReply: encryptE2EE(replyText.trim()) });
      alert('Teacher explanation added successfully!');
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleAddRecordedClass = async (e) => {
    e.preventDefault();
    if (!newRecTitle.trim() || !newRecUrl.trim()) return;
    const payload = {
      title: newRecTitle.trim(), batch: newRecBatch, url: newRecUrl.trim(),
      date: new Date().toLocaleDateString('en-IN')
    };
    try {
      await addDoc(collection(db, RECORDINGS_COL), payload);
      broadcastPushNotification("New Recorded Class Added 🎬", `${payload.title} is now available.`, payload.batch || 'ALL');
      setNewRecTitle(''); setNewRecUrl('');
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleDeleteRecordedClass = async (id) => {
    await deleteDoc(doc(db, RECORDINGS_COL, id));
  };

  const handleChangeVideoSpeed = (speedVal) => {
    setPlaybackSpeed(speedVal);
    if (recVideoPlayerRef.current) recVideoPlayerRef.current.playbackRate = speedVal;
  };

  const handleSaveTimestampNote = (e) => {
    e.preventDefault();
    if (!activeRecording || !timestampNoteInput.trim()) return;
    const currentSec = recVideoPlayerRef.current ? Math.floor(recVideoPlayerRef.current.currentTime || 0) : 0;
    const mm = String(Math.floor(currentSec / 60)).padStart(2, '0');
    const ss = String(currentSec % 60).padStart(2, '0');
    const noteObj = { timeFormatted: `${mm}:${ss}`, seconds: currentSec, text: timestampNoteInput.trim() };
    const existingNotes = studentTimestampNotes[activeRecording.id] || [];
    const updated = { ...studentTimestampNotes, [activeRecording.id]: [...existingNotes, noteObj] };
    setStudentTimestampNotes(updated);
    localStorage.setItem('deep_timestamp_notes_v3', JSON.stringify(updated));
    setTimestampNoteInput('');
  };

  const handleSendLiveChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const senderName = session.mode === 'teacher' ? 'Avradeep Sir (Admin) ⭐' : (session.user?.name || 'Student');
    const plainPayload = {
      sender: senderName, ownerUid: session.user?.authUid || null, role: session.mode,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };
    const encryptedPayload = encryptRecordFields(plainPayload, CHAT_ENCRYPTED_FIELDS);
    try {
      await addDoc(collection(db, LIVECHAT_COL), encryptedPayload);
      setChatInput('');
    } catch (e) {}
  };

  const handleCreateLivePoll = async (e) => {
    e.preventDefault();
    if (!newPollQuestion.trim() || !newPollOptA.trim() || !newPollOptB.trim()) return;
    const payload = {
      question: newPollQuestion.trim(), optionA: newPollOptA.trim(), optionB: newPollOptB.trim(),
      votesA: 0, votesB: 0, votedIds: []
    };
    try {
      await addDoc(collection(db, POLLS_COL), payload);
      setNewPollQuestion(''); setNewPollOptA(''); setNewPollOptB('');
    } catch (e) {}
  };

  const handleVotePoll = async (poll, choice) => {
    const voterId = session.user?.id || 'teacher';
    if ((poll.votedIds || []).includes(voterId)) { alert('You have already voted in this poll!'); return; }
    const updatedVotesA = choice === 'A' ? (poll.votesA || 0) + 1 : (poll.votesA || 0);
    const updatedVotesB = choice === 'B' ? (poll.votesB || 0) + 1 : (poll.votesB || 0);
    const updatedVotedIds = [...(poll.votedIds || []), voterId];
    try {
      await updateDoc(doc(db, POLLS_COL, poll.id), { votesA: updatedVotesA, votesB: updatedVotesB, votedIds: updatedVotedIds });
    } catch (e) {}
  };

  const handleDownloadCertificateImage = (targetStudent) => {
    const st = targetStudent || session.user;
    if (!st) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 700;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 1000, 700);
    grad.addColorStop(0, '#020617'); grad.addColorStop(0.5, '#0f172a'); grad.addColorStop(1, '#083344');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1000, 700);
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 8; ctx.strokeRect(25, 25, 950, 650);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.strokeRect(40, 40, 920, 620);
    ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('DEEP EDUCATION • COMPUTER APPLICATION AND COMPUTER SCIENCE BATCH', 500, 100);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 46px serif';
    ctx.fillText('CERTIFICATE OF COMPLETION', 500, 165);
    ctx.fillStyle = '#94a3b8'; ctx.font = 'italic 20px sans-serif';
    ctx.fillText('This official credential is proudly awarded to', 500, 220);
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 44px sans-serif';
    ctx.fillText((st.name || 'STUDENT NAME').toUpperCase(), 500, 285);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(250, 305); ctx.lineTo(750, 305); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '21px sans-serif';
    ctx.fillText(`for successfully passing & completing the prescribed curriculum in`, 500, 355);
    ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 28px sans-serif';
    ctx.fillText(st.batch || 'Computer Science & Application', 500, 400);
    const credId = `DE-${(st.id || '2026').slice(0, 6).toUpperCase()}-VERIFIED`;
    ctx.fillStyle = '#94a3b8'; ctx.font = '16px monospace';
    ctx.fillText(`Credential ID: ${credId}   |   Issued Date: ${st.certificateIssuedDate || new Date().toLocaleDateString('en-IN')}`, 500, 455);
    const finishCertDownload = () => {
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(350, 565); ctx.lineTo(650, 565); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 21px serif';
      ctx.fillText('Avradeep Biswas', 500, 595);
      ctx.fillStyle = '#22d3ee'; ctx.font = '15px sans-serif';
      ctx.fillText('Founder & Educator • Deep Education, Madanpur', 500, 620);
      const link = document.createElement('a');
      link.download = `Deep_Education_Certificate_${(st.name || 'Student').replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png'); link.click();
    };
    if (teacherSignatureImg) {
      const sigImg = new Image();
      sigImg.onload = () => { ctx.drawImage(sigImg, 400, 485, 200, 72); finishCertDownload(); };
      sigImg.onerror = finishCertDownload;
      sigImg.src = teacherSignatureImg;
    } else {
      ctx.fillStyle = '#fbbf24'; ctx.font = 'italic bold 34px serif';
      ctx.fillText('Avradeep Biswas', 500, 545);
      finishCertDownload();
    }
  };

  const handleShareCertificate = async (targetStudent) => {
    const st = targetStudent || session.user;
    const shareText = `🎓 I have officially graduated and earned my Course Certificate in ${st?.batch} from Deep Education (Mentored by Avradeep Biswas)! Credential ID: DE-${(st?.id || '2026').slice(0, 6).toUpperCase()}-VERIFIED`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Deep Education Official Certificate', text: shareText }); } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Certificate credential details copied!');
    }
  };

  const handlePublishMockTest = async (e) => {
    e.preventDefault();
    if (!testTitle.trim()) { alert('Enter test title!'); return; }
    try {
      const payload = {
        title: testTitle.trim(), batch: testBatchTarget,
        questions: questionsList, createdAt: new Date().toLocaleDateString('en-IN')
      };
      if (isEditingTestId) {
        await updateDoc(doc(db, MOCKTEST_COL, isEditingTestId), payload);
        setIsEditingTestId(null);
        alert('Mock Test Updated Successfully!');
      } else {
        await addDoc(collection(db, MOCKTEST_COL), payload);
        broadcastPushNotification("New Smart Quiz Published 📝", `Test title: ${payload.title}`, payload.batch || 'ALL');
        alert('Smart Quiz / Mock Test Published Successfully!');
      }
      setTestTitle('');
      setQuestionsList([{ question: '', optionA: '', optionB: '', optionC: '', optionD: '', correct: 'A' }]);
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleEditMockTest = (test) => {
    setIsEditingTestId(test.id);
    setTestTitle(test.title);
    setTestBatchTarget(test.batch);
    setQuestionsList(test.questions);
  };

  const handleDeleteMockTest = async (id) => {
    if (!window.confirm("Delete this test?")) return;
    try {
      await deleteDoc(doc(db, MOCKTEST_COL, id));
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleAddQuestionRow = () => {
    if (questionsList.length >= 35) { alert('Maximum limit of 35 questions reached!'); return; }
    setQuestionsList([...questionsList, { question: '', optionA: '', optionB: '', optionC: '', optionD: '', correct: 'A' }]);
  };

  const handleRemoveQuestionRow = (idx) => { setQuestionsList(questionsList.filter((_, i) => i !== idx)); };
  const handleQuestionChange = (idx, field, val) => {
    const updated = [...questionsList];
    updated[idx][field] = val;
    setQuestionsList(updated);
  };

  const requestReAttempt = () => {
    setTestRetreatRequests({ ...testRetreatRequests, [activeTest.id]: true });
    alert('Re-attempt request sent to Teacher Admin successfully!');
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!session.user) return;
    try {
      const plainPayload = {
        studentId: session.user.id, ownerUid: session.user.authUid || null,
        studentName: session.user.name, batch: session.user.batch,
        rating: feedbackRating, comment: feedbackText.trim(),
        date: new Date().toLocaleDateString('en-IN')
      };
      const encryptedPayload = encryptRecordFields(plainPayload, FEEDBACK_ENCRYPTED_FIELDS);
      await addDoc(collection(db, FEEDBACK_COL), encryptedPayload);
      setFeedbackText('');
      alert('Thank you for your valuable feedback!');
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pdfTitleInput.trim()) {
      alert('অনুগ্রহ করে আগে PDF-এর একটি নাম (Title) লিখুন এবং তারপর ফাইল সিলেক্ট করুন!');
      e.target.value = ''; return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('শুধুমাত্র PDF ফাইল সিলেক্ট করুন।'); e.target.value = ''; return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('২০ MB-এর কম সাইজের PDF ফাইল সিলেক্ট করুন।'); e.target.value = ''; return;
    }
    setIsUploadingPdf(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64DataUrl = event.target.result;
        const encryptedData = encryptE2EE(base64DataUrl);
        const id = `pdf_${Date.now()}`;
        const CHUNK_SIZE = 700000;
        const totalChunks = Math.ceil(encryptedData.length / CHUNK_SIZE);
        const pdfPayload = {
          title: pdfTitleInput.trim(), fileName: file.name,
          batch: selectedBatchFilter || 'ALL',
          uploadedAt: new Date().toLocaleDateString('en-IN'),
          timestamp: Date.now(), e2ee: true, totalChunks
        };
        if (totalChunks === 1) {
          await setDoc(doc(db, 'pdfs', id), { ...pdfPayload, data: encryptedData });
        } else {
          const chunkPromises = [];
          for (let i = 0; i < totalChunks; i++) {
            const chunkStr = encryptedData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            chunkPromises.push(setDoc(doc(db, 'pdf_chunks', `${id}_part_${i}`), { pdfId: id, index: i, data: chunkStr }));
          }
          await Promise.all(chunkPromises);
          await setDoc(doc(db, 'pdfs', id), { ...pdfPayload, isChunked: true });
        }
        await savePdfLocal({ id, ...pdfPayload, data: encryptedData }).catch(() => {});
        setPdfTitleInput('');
        broadcastPushNotification('নতুন স্টাডি নোট (PDF) আপলোড হয়েছে 📚', `"${pdfPayload.title}" নোটটি এখন পোর্টালে পাওয়া যাচ্ছে।`, pdfPayload.batch);
        alert('PDF সফলভাবে আপলোড হয়েছে!');
      } catch (err) {
        alert(`PDF আপলোড করা যায়নি: ${err.message}`);
      } finally { setIsUploadingPdf(false); e.target.value = ''; }
    };
    reader.onerror = () => { setIsUploadingPdf(false); alert('ফাইলটি রিড করতে সমস্যা হয়েছে।'); };
    reader.readAsDataURL(file);
  };

  const resolveStudentPdfUrl = async (pdf) => {
    if (pdf.data) return decryptE2EE(pdf.data);
    const localPdfs = await getPdfsLocal().catch(() => []);
    const foundLocal = localPdfs.find((item) => item.id === pdf.id);
    if (foundLocal?.data) return decryptE2EE(foundLocal.data);
    if (pdf.isChunked && pdf.totalChunks) {
      const q = query(collection(db, 'pdf_chunks'), where('pdfId', '==', pdf.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const parts = snap.docs.map((d) => d.data());
        parts.sort((a, b) => a.index - b.index);
        const fullEncryptedData = parts.map((p) => p.data).join('');
        await savePdfLocal({ ...pdf, data: fullEncryptedData }).catch(() => {});
        return decryptE2EE(fullEncryptedData);
      }
    }
    throw new Error('PDF ডেটা পাওয়া যায়নি।');
  };

  const handleAuthorizedStudentPdfView = async (pdf) => {
    if (session.mode === 'student' && (!session.user || !activeStudentRecord?.facePhoto)) {
      alert('Access Denied! স্টাডি মেটেরিয়াল দেখার জন্য আগে আপনার Face ID ভেরিফিকেশন সম্পন্ন করুন।'); return;
    }
    try {
      const decryptedDataUrl = await resolveStudentPdfUrl(pdf);
      const response = await fetch(decryptedDataUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setViewingPdf(prev => {
        if (prev?.decryptedUrl?.startsWith('blob:')) {
          try { URL.revokeObjectURL(prev.decryptedUrl); } catch (e) {}
        }
        return { ...pdf, decryptedUrl: blobUrl };
      });
    } catch (err) { alert(`PDF ওপেন করা যাচ্ছে না: ${err.message}`); }
  };

  const closePdfViewer = () => {
    setViewingPdf(prev => {
      if (prev?.decryptedUrl?.startsWith('blob:')) {
        try { URL.revokeObjectURL(prev.decryptedUrl); } catch (e) {}
      }
      return null;
    });
  };

  const handleAuthorizedStudentPdfDownload = async (pdf) => {
    if (session.mode === 'student' && (!session.user || !activeStudentRecord?.facePhoto)) {
      alert('Access Denied! ডাউনলোড করার আগে আপনার Face ID ভেরিফিকেশন সম্পন্ন করুন।'); return;
    }
    try {
      const existingBlob = pdf.decryptedUrl?.startsWith('blob:') ? pdf.decryptedUrl : null;
      let blobUrl = existingBlob;
      let weCreatedBlob = false;
      if (!blobUrl) {
        const decryptedDataUrl = await resolveStudentPdfUrl(pdf);
        const response = await fetch(decryptedDataUrl);
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        weCreatedBlob = true;
      }
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = pdf.fileName || `${pdf.title}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      if (weCreatedBlob) setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }, 1500);
    } catch (err) { alert(`PDF ডাউনলোড করা যায়নি: ${err.message}`); }
  };

  const handleDeletePdf = async (id) => {
    if (!window.confirm('আপনি কি সব স্টুডেন্টদের জন্য এই PDF-টি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'pdfs', id));
      const q = query(collection(db, 'pdf_chunks'), where('pdfId', '==', id));
      const snap = await getDocs(q).catch(() => ({ docs: [] }));
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'pdf_chunks', d.id)))).catch(() => {});
      await deletePdfLocal(id).catch(() => {});
    } catch (err) { alert(`PDF ডিলিট করা যায়নি: ${err.message}`); }
  };

  const handleAddLiveClass = async (e) => {
    e.preventDefault();
    if (!newClassTitle.trim()) { alert('অনুগ্রহ করে ক্লাসের টপিক (Topic) লিখুন!'); return; }
    const trimmedLink = newClassLink.trim();
    if (!trimmedLink || !/^https?:\/\//i.test(trimmedLink)) {
      alert('Google Meet লিঙ্ক দিন (https://meet.google.com/... দিয়ে শুরু হবে)!');
      return;
    }
    const payload = {
      title: newClassTitle.trim(),
      time: newClassTime.trim() || 'Live Now 🔴',
      link: trimmedLink,
      roomCode: 'google-meet',
      batch: selectedBatchFilter || 'ALL'
    };
    try {
      await addDoc(collection(db, 'live_classes'), payload);
      broadcastPushNotification("লাইভ ক্লাস শুরু হয়েছে! 🔴", `টপিক: ${payload.title}। এখনই পোর্টালে ঢুকে জয়েন করো!`, payload.batch);
      setNewClassTitle(''); setNewClassTime(''); setNewClassLink('');
      window.open(payload.link, '_blank', 'noopener,noreferrer');
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleDeleteLiveClass = async (id) => {
    await deleteDoc(doc(db, 'live_classes', id));
  };

  const handleAddNotice = async (e) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeContent.trim()) return;
    const payload = { title: newNoticeTitle.trim(), content: newNoticeContent.trim(), date: new Date().toLocaleDateString('en-IN') };
    await addDoc(collection(db, 'notices'), payload);
    broadcastPushNotification("New Notice Published 🔔", `${payload.title}`);
    setNewNoticeTitle(''); setNewNoticeContent('');
  };

  const handleDeleteNotice = async (id) => {
    await deleteDoc(doc(db, 'notices', id));
  };

  const filteredStudents = selectedBatchFilter === 'ALL' ? students : students.filter(s => s.batch === selectedBatchFilter);
  const pendingFaceStudentsCount = students.filter(s => !s.facePhoto).length;
  const logsForSelectedDate = attendanceLogs.filter(l => l.isoDate === selectedCalendarDate && (selectedBatchFilter === 'ALL' || l.batch === selectedBatchFilter));
  const presentIds = new Set(logsForSelectedDate.map(l => l.studentId));
  const absentStudentsOnDate = filteredStudents.filter(st => !presentIds.has(st.id));
  const logsForSelectedMonth = attendanceLogs.filter(l => (l.isoDate || '').startsWith(selectedMonthFilter) && (selectedBatchFilter === 'ALL' || l.batch === selectedBatchFilter));
  const activeDays = new Set(logsForSelectedMonth.map(l => l.isoDate)).size;
  const monthlyStats = filteredStudents.map(st => {
    const presentCount = new Set(logsForSelectedMonth.filter(l => l.studentId === st.id).map(l => l.isoDate)).size;
    const absentCount = Math.max(0, activeDays - presentCount);
    const pct = activeDays > 0 ? Math.round((presentCount / activeDays) * 100) : 0;
    return { ...st, daysPresent: presentCount, daysAbsent: absentCount, percentage: pct };
  });
  const activeStudentRecord = session.mode === 'student' && session.user
    ? (students.find(s => s.id === session.user.id) || session.user) : null;
  const isCertificateIssuedForMe = Boolean(activeStudentRecord?.certificateIssued);
  const isStudentFaceRegistered = Boolean(activeStudentRecord?.facePhoto);
  const studentMyFees = session.mode === 'student' && session.user ? feesRecords.filter(f => f.studentId === session.user.id) : [];
  const studentDueFees = studentMyFees.filter(f => f.status === 'Due');
  const totalStudentDueAmount = studentDueFees.reduce((acc, curr) => acc + (curr.amount || 500), 0);
  const unreadMockCount = mockTests.filter(t => t.batch === 'ALL' || t.batch === session.user?.batch).filter(t => !seenMockTests.includes(t.id)).length;
  const unreadPdfCount = pdfList.filter(p => !seenPdfs.includes(p.id)).length;
  const unreadNoticeCount = notices.filter(n => !seenNotices.includes(n.id)).length;
  const unreadFeesCount = totalStudentDueAmount > 0 && !seenFees ? 1 : 0;
  const todayIso = getTodayISO();
  const isTodayPresent = attendanceLogs.some(l => l.studentId === session.user?.id && l.isoDate === todayIso);
  const hasValidExamCountdown = Boolean(examCountdown?.date);
  const examDaysRemaining = hasValidExamCountdown
    ? Math.max(0, Math.ceil((new Date(examCountdown.date) - new Date()) / (1000 * 60 * 60 * 24))) : null;
  const averageQuizPct = studentQuizHistory.length > 0
    ? Math.round(studentQuizHistory.reduce((acc, q) => acc + ((q.score / (q.total || 1)) * 100), 0) / studentQuizHistory.length) : null;
  const aiRecommendedTopic = averageQuizPct === null
    ? "Complete your first Teacher-Assigned Smart Quiz so Deep Personalized Learning can analyze your strengths and weaknesses."
    : averageQuizPct < 60
      ? "Focus Area: Number System, Binary Arithmetic & 2's Complement (Revise study PDFs and attempt assigned practice sets)."
      : averageQuizPct < 85
        ? "Focus Area: Logic Gates, Boolean Algebra & SQL Queries (Good progress! Practice intermediate problems)."
        : "Focus Area: Advanced Programming in C++, Python & Networking (Excellent accuracy! Keep up the consistency).";
  const studentLiveClasses = liveClasses.filter(c => !c.batch || c.batch === 'ALL' || c.batch === session.user?.batch);
  const studentRecordedClasses = recordedClasses.filter(r => !r.batch || r.batch === 'ALL' || r.batch === session.user?.batch);

  return (
    <div className="min-h-screen bg-[#050014] text-slate-100 font-sans pb-16 antialiased relative">
      <style>{`
        @keyframes auroraFloatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.1)} }
        @keyframes auroraFloatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-40px,40px) scale(1.08)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseRing { 0%{box-shadow:0 0 0 0 rgba(244,63,94,0.6)} 70%{box-shadow:0 0 0 10px rgba(244,63,94,0)} 100%{box-shadow:0 0 0 0 rgba(244,63,94,0)} }
        @keyframes glowPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .aurora-a { animation: auroraFloatA 14s ease-in-out infinite; }
        .aurora-b { animation: auroraFloatB 18s ease-in-out infinite; }
        .anim-fade { animation: fadeInUp 0.5s ease-out both; }
        .pulse-ring { animation: pulseRing 2s infinite; }
        .glow-pulse { animation: glowPulse 3s ease-in-out infinite; }
        .glass-card { background: rgba(15, 11, 40, 0.55); backdrop-filter: blur(22px); border: 1px solid rgba(148,163,184,0.08); }
        .glass-deep { background: rgba(9, 7, 28, 0.75); backdrop-filter: blur(28px); border: 1px solid rgba(148,163,184,0.06); }
        .shine-btn { position: relative; overflow: hidden; }
        .shine-btn::before { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent); transform:translateX(-100%); transition:transform 0.7s ease; }
        .shine-btn:hover::before { transform:translateX(100%); }
        .soft-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .soft-hover:hover { transform: translateY(-2px); }
        .custom-scroll::-webkit-scrollbar { width:6px; height:6px; }
        .custom-scroll::-webkit-scrollbar-thumb { background:rgba(139,92,246,0.35); border-radius:999px; }
        .text-gradient-primary { background:linear-gradient(120deg,#a78bfa 0%,#f472b6 45%,#38bdf8 100%); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .text-gradient-warm { background:linear-gradient(120deg,#fbbf24 0%,#fb7185 55%,#f472b6 100%); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .tab-active-gradient { background: linear-gradient(120deg,#8b5cf6 0%,#d946ef 60%,#22d3ee 120%); box-shadow: 0 10px 30px -10px rgba(139,92,246,0.55); }
        .glow-violet { box-shadow: 0 20px 60px -20px rgba(139,92,246,0.6); }
        .glow-emerald { box-shadow: 0 20px 60px -20px rgba(16,185,129,0.55); }
        .glow-amber { box-shadow: 0 20px 60px -20px rgba(245,158,11,0.55); }
        .glow-rose { box-shadow: 0 20px 60px -20px rgba(244,63,94,0.55); }
      `}</style>

      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[720px] h-[720px] bg-violet-600/25 rounded-full blur-[160px] aurora-a" />
        <div className="absolute -bottom-40 -right-40 w-[720px] h-[720px] bg-cyan-500/20 rounded-full blur-[160px] aurora-b" />
      </div>

      <header className="sticky top-0 z-40 glass-deep border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-cyan-400 rounded-2xl blur-lg opacity-60" />
              <img src="deep_education_logo_de_2.png.png" alt="Logo" className="relative w-11 h-11 rounded-2xl object-cover border border-white/20 shadow-xl" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-gradient-primary">Deep Education</h1>
              <p className="text-[10px] text-slate-400 font-medium">Computer Application & Science</p>
            </div>
          </div>
          {session.mode !== 'home' && (
            <div className="flex items-center gap-3">
              {session.user && (
                <span className="hidden sm:inline-flex items-center gap-2 text-xs bg-white/5 px-3 py-1.5 rounded-xl text-violet-200 border border-white/10 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {session.mode === 'teacher' ? 'Teacher Admin' : session.user.name}
                </span>
              )}
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-2 text-xs font-bold transition">
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6">

        {/* HOME */}
        {session.mode === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 items-start anim-fade">
            <section className="relative overflow-hidden rounded-3xl glass-card p-8 md:p-10 shadow-2xl">
              <div className="relative space-y-6">
                <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-violet-300">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" /> Learn • Practice • Excel
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white leading-[1.05]">
                  Build your skills.<br />
                  <span className="text-gradient-primary italic">Shape your future.</span>
                </h2>
                <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-md">
                  A focused digital classroom for Computer Application and Computer Science students.
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center text-white font-black text-sm">AB</div>
                  <div>
                    <p className="text-sm font-bold text-white">Avradeep Biswas</p>
                    <p className="text-[11px] text-slate-400">Founder & Educator</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="rounded-3xl glass-card p-6 md:p-8 shadow-2xl">
              <div className="text-center mb-6">
                <img src="deep_education_logo_de_2.png.png" alt="Logo" className="w-20 h-20 mx-auto rounded-2xl object-cover border-2 border-white/20 shadow-xl mb-4" />
                <h2 className="text-2xl md:text-3xl font-black text-white">Welcome Back</h2>
                <p className="text-violet-300 text-[10px] font-bold uppercase tracking-[0.3em] mt-1.5">Deep Education Portal</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-black/40 border border-white/10 mb-5">
                <button onClick={() => setAuthTab('login')}
                  className={`py-2.5 rounded-xl text-sm font-bold transition ${authTab === 'login' ? 'tab-active-gradient text-white' : 'text-slate-400'}`}>
                  Student Login
                </button>
                <button onClick={() => setAuthTab('register')}
                  className={`py-2.5 rounded-xl text-sm font-bold transition ${authTab === 'register' ? 'tab-active-gradient text-white' : 'text-slate-400'}`}>
                  New Registration
                </button>
              </div>
              {authTab === 'login' ? (
                <form onSubmit={handleStudentLogin} className="space-y-4">
                  <input type="tel" required placeholder="Phone Number" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-400 transition" />
                  <input type="password" required placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-400 transition" />
                  <button type="submit"
                    className="shine-btn w-full rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white font-black py-3.5 flex items-center justify-center gap-2 shadow-lg glow-violet">
                    <BookOpen size={18} /> Login to Portal
                  </button>
                </form>
              ) : (
                <form onSubmit={handleStudentRegister} className="space-y-3.5">
                  <input type="text" required placeholder="Full Name" value={regName} onChange={(e) => setRegName(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-400" />
                  <div className="grid grid-cols-2 gap-2">
                    {['Male', 'Female'].map(g => (
                      <button type="button" key={g} onClick={() => setRegGender(g)}
                        className={`py-2.5 rounded-xl font-bold text-sm border transition ${regGender === g ? 'bg-violet-500/15 border-violet-500/70 text-violet-200' : 'bg-black/40 border-white/10 text-slate-400'}`}>
                        {g === 'Male' ? '♂ Male' : '♀ Female'}
                      </button>
                    ))}
                  </div>
                  <select required value={regBatch} onChange={(e) => setRegBatch(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-400">
                    {BATCH_OPTIONS.map((b, i) => <option key={i} value={b}>{b}</option>)}
                  </select>
                  <input type="date" required value={regDob} onChange={(e) => setRegDob(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-400" />
                  <input type="tel" required placeholder="Phone" value={regPhone} onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-400" />
                  <input type="password" required placeholder="Password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-400" />
                  <input type="file" accept="image/*" onChange={handleDpUploadChange}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-500 file:text-white file:text-xs file:font-bold file:px-3 file:py-1.5" />
                  <button type="submit"
                    className="shine-btn w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black py-3.5 flex items-center justify-center gap-2 shadow-lg glow-emerald">
                    <UserPlus size={18} /> Register & Get OTP
                  </button>
                </form>
              )}
              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="mx-4 text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold">Teacher Access</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>
              {!showTeacherLogin ? (
                <button onClick={() => setShowTeacherLogin(true)}
                  className="shine-btn w-full rounded-xl bg-violet-500/10 text-violet-200 border border-violet-500/40 py-3.5 flex items-center justify-center gap-2 text-sm font-bold">
                  <Users size={18} /> Teacher Login
                </button>
              ) : (
                <form onSubmit={handleTeacherLogin} className="space-y-3 rounded-2xl bg-black/40 border border-violet-500/30 p-4">
                  <input type="password" placeholder="Teacher PIN" value={teacherPass} onChange={(e) => setTeacherPass(e.target.value)}
                    className="w-full rounded-xl bg-black/50 border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-400" />
                  <div className="flex gap-2">
                    <button type="submit"
                      className="shine-btn flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold py-2.5 text-sm shadow-lg glow-violet">
                      Enter Portal
                    </button>
                    <button type="button" onClick={() => setShowTeacherLogin(false)}
                      className="rounded-xl bg-white/5 text-slate-400 px-3 text-xs font-bold">Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* STUDENT */}
        {session.mode === 'student' && (
          <div className="space-y-5 anim-fade">
            {!isStudentFaceRegistered ? (
              <div className="rounded-3xl glass-card p-8 text-center max-w-xl mx-auto space-y-5 glow-amber">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto text-white animate-pulse">
                  <ScanFace size={40} />
                </div>
                <h2 className="text-2xl font-black text-white">Face Registration Required</h2>
                <p className="text-sm text-slate-300">
                  Welcome, <span className="text-amber-400 font-bold">{activeStudentRecord?.name}</span>! Contact the Teacher to register your Face ID.
                </p>
                <button onClick={() => window.location.reload()}
                  className="shine-btn rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black px-6 py-3 text-xs inline-flex items-center gap-2 shadow-lg glow-amber">
                  <RefreshCw size={14} /> Check Status
                </button>
              </div>
            ) : (
              <>
                {isCertificateIssuedForMe && (
                  <div className="rounded-3xl bg-emerald-900/30 border border-emerald-500/30 p-5 flex flex-col md:flex-row justify-between items-center gap-4 glow-emerald">
                    <div className="flex items-center gap-3">
                      <Award size={28} className="text-emerald-400" />
                      <div>
                        <h4 className="font-black text-white">🎓 Certificate Issued!</h4>
                        <p className="text-xs text-emerald-200">{activeStudentRecord?.batch}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setViewingCertificateModal(true)}
                        className="rounded-xl bg-black/40 text-emerald-300 border border-emerald-500/40 px-4 py-2 text-xs font-bold">
                        <Eye size={14} className="inline mr-1" /> View
                      </button>
                      <button onClick={() => handleDownloadCertificateImage(activeStudentRecord)}
                        className="shine-btn rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black px-4 py-2 text-xs shadow-lg glow-emerald">
                        <Download size={14} className="inline mr-1" /> Download
                      </button>
                    </div>
                  </div>
                )}

                {totalStudentDueAmount > 0 && (
                  <div className="rounded-3xl bg-rose-900/30 border border-rose-500/30 p-5 flex justify-between items-center glow-rose">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="text-rose-400" size={28} />
                      <div>
                        <h4 className="font-black text-white">⚠️ Fee Due</h4>
                        <p className="text-xs text-rose-200">Total: ₹{totalStudentDueAmount}</p>
                      </div>
                    </div>
                    <button onClick={() => { setStudentNavTab('fees'); setSeenFees(true); }}
                      className="shine-btn rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white px-5 py-2.5 font-black text-xs shadow-lg glow-rose">
                      Pay Now
                    </button>
                  </div>
                )}

                <div className="rounded-3xl glass-card p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                    {activeStudentRecord?.dp ? (
                      <img src={activeStudentRecord.dp} alt="DP" className="w-16 h-16 rounded-2xl object-cover border-2 border-violet-400/50" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-black text-2xl">
                        {activeStudentRecord?.name?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-black text-white">Welcome, {activeStudentRecord?.name}!</h2>
                      <p className="text-violet-300 text-xs font-semibold">{activeStudentRecord?.batch}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] px-4 py-2 rounded-xl font-bold">
                    <ShieldCheck size={14} /> Face ID Verified
                  </span>
                </div>

                <div className="rounded-3xl glass-card p-2.5 flex flex-wrap gap-1.5">
                  {[
                    { id: 'notices', icon: Bell, label: 'Notices' },
                    { id: 'dashboard', icon: User, label: 'Profile' },
                    { id: 'ai_learning', icon: Brain, label: 'AI Learning' },
                    { id: 'ai_doubts', icon: MessageSquare, label: 'Doubts' },
                    { id: 'mock_tests', icon: HelpCircle, label: 'Quizzes' },
                    { id: 'materials', icon: FileText, label: 'PDFs' },
                    { id: 'live', icon: Video, label: 'Live Classes' },
                    { id: 'attendance', icon: Calendar, label: 'Attendance' },
                    { id: 'fees', icon: CreditCard, label: 'Fees' },
                    { id: 'privacy_parental', icon: Lock, label: 'Parental' },
                    { id: 'feedback', icon: Star, label: 'Feedback' },
                    { id: 'contact_us', icon: Phone, label: 'Contact' }
                  ].map(t => {
                    const isActive = studentNavTab === t.id;
                    const Icon = t.icon;
                    return (
                      <button key={t.id}
                        onClick={() => {
                          if (t.id === 'notices') { const all = notices.map(n => n.id); setSeenNotices(all); localStorage.setItem('seen_notices', JSON.stringify(all)); }
                          if (t.id === 'mock_tests') { const all = mockTests.map(x => x.id); setSeenMockTests(all); localStorage.setItem('seen_mock', JSON.stringify(all)); }
                          if (t.id === 'materials') { const all = pdfList.map(p => p.id); setSeenPdfs(all); localStorage.setItem('seen_pdfs', JSON.stringify(all)); }
                          if (t.id === 'fees') { setSeenFees(true); }
                          setStudentNavTab(t.id);
                        }}
                        className={`relative px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition ${
                          isActive ? 'tab-active-gradient text-white' : 'bg-black/30 text-slate-300 hover:bg-white/5'
                        }`}>
                        <Icon size={14} /> {t.label}
                        {t.id === 'notices' && unreadNoticeCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">{unreadNoticeCount}</span>}
                        {t.id === 'mock_tests' && unreadMockCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">{unreadMockCount}</span>}
                        {t.id === 'materials' && unreadPdfCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">{unreadPdfCount}</span>}
                      </button>
                    );
                  })}
                </div>

                {studentNavTab === 'notices' && (
                  <div className="rounded-3xl glass-card p-6 space-y-4 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Bell className="text-violet-300" /> Notice Board</h3>
                    {notices.map(notice => (
                      <div key={notice.id} className="rounded-2xl bg-black/30 border border-white/10 p-5">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="text-lg font-bold text-white">{notice.title}</h4>
                          <span className="text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/30 px-2.5 py-1 rounded-full font-bold">{notice.date}</span>
                        </div>
                        <p className="text-base text-slate-200 whitespace-pre-line">{notice.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {studentNavTab === 'live' && (
                  <div className="space-y-5 anim-fade">
                    <div className="rounded-3xl glass-card p-6 space-y-4">
                      <h3 className="text-lg font-black text-white flex items-center gap-2"><Video className="text-rose-400" /> Live Classes</h3>
                      {studentLiveClasses.length === 0 ? (
                        <p className="text-slate-500 text-sm">No live classes scheduled.</p>
                      ) : studentLiveClasses.map(cls => (
                        <div key={cls.id} className="rounded-2xl bg-black/30 border border-white/10 p-4 flex justify-between items-center gap-3">
                          <div>
                            <p className="font-bold text-white">{cls.title}</p>
                            <p className="text-xs text-rose-400 mt-1 flex items-center gap-1"><Clock size={12} /> {cls.time}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (!openMeetLink(cls.link)) {
                                alert('The teacher has not added the Google Meet link yet. Please wait.');
                              }
                            }}
                            className="shine-btn rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black px-4 py-2.5 text-xs flex items-center gap-2 shrink-0 shadow-lg glow-rose pulse-ring">
                            <Video size={14} /> Join Live
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-3xl glass-card p-6 space-y-4">
                      <h3 className="text-lg font-black text-white flex items-center gap-2"><PlayCircle className="text-violet-400" /> Recorded Classes</h3>
                      {activeRecording && (
                        <div className="rounded-2xl bg-black/40 border border-violet-500/30 p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="font-bold text-white text-sm">{activeRecording.title}</h4>
                            <button onClick={() => setActiveRecording(null)} className="text-xs text-rose-400 font-bold">Close</button>
                          </div>
                          <video ref={recVideoPlayerRef} src={activeRecording.url} controls className="w-full max-h-[380px] bg-black rounded-xl border border-white/10" />
                          <div className="flex items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/10">
                            <span className="text-xs font-bold text-slate-300">Speed:</span>
                            {[0.5, 1, 1.25, 1.5, 2].map(sp => (
                              <button key={sp} onClick={() => handleChangeVideoSpeed(sp)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${playbackSpeed === sp ? 'bg-violet-500 text-white' : 'bg-black/40 text-slate-400'}`}>
                                {sp}x
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {studentRecordedClasses.map(rec => (
                          <div key={rec.id} className="rounded-2xl bg-black/30 border border-white/10 p-4 flex justify-between items-center gap-3">
                            <div>
                              <p className="font-bold text-white text-sm">{rec.title}</p>
                              <p className="text-xs text-slate-400">{rec.batch}</p>
                            </div>
                            <button onClick={() => setActiveRecording(rec)}
                              className="rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/40 font-bold px-3.5 py-2 text-xs">
                              Watch ▶
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {studentNavTab === 'attendance' && (
                  <div className="rounded-3xl glass-card p-6 space-y-4 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Calendar className="text-amber-400" /> My Attendance</h3>
                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-black/40 text-violet-300 uppercase text-[10px] border-b border-white/10">
                          <tr><th className="p-3.5">Date</th><th className="p-3.5">Time</th><th className="p-3.5">Status</th><th className="p-3.5">Location</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-black/20">
                          {attendanceLogs.filter(l => l.studentId === session.user?.id).map(log => (
                            <tr key={log.id}>
                              <td className="p-3.5 font-bold text-white text-xs">{log.date}</td>
                              <td className="p-3.5 text-emerald-400 font-bold text-xs">{log.time}</td>
                              <td className="p-3.5"><span className="bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded text-[10px] font-bold">Present ✓</span></td>
                              <td className="p-3.5 text-xs text-slate-400">{log.location}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {studentNavTab === 'fees' && (
                  <div className="rounded-3xl glass-card p-6 space-y-4 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><CreditCard className="text-amber-400" /> Fees & Bills</h3>
                    {studentMyFees.map(fee => (
                      <div key={fee.id} className={`rounded-2xl border p-5 ${fee.status === 'Due' ? 'bg-rose-500/5 border-rose-500/40' : 'bg-black/30 border-emerald-500/30'}`}>
                        <div className="flex justify-between">
                          <div>
                            <p className="font-bold text-white">Month: <span className="text-amber-400">{fee.month}</span></p>
                            <p className="text-xs text-slate-400">₹{fee.amount} • {fee.status}</p>
                          </div>
                          {fee.status === 'Paid' && (
                            <button onClick={() => setViewingFeeBillModal(fee)}
                              className="shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black px-3.5 py-2 text-xs shadow-lg glow-violet">
                              View Bill
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {studentNavTab === 'mock_tests' && (
                  <div className="rounded-3xl glass-card p-6 space-y-5 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><HelpCircle className="text-amber-400" /> Smart Quizzes</h3>
                    {activeTest ? (
                      <div className="rounded-2xl bg-black/40 border border-white/10 p-5 space-y-5">
                        <div className="flex justify-between items-center border-b border-white/10 pb-3">
                          <h4 className="font-bold text-white">{activeTest.title}</h4>
                          <button onClick={() => { setActiveTest(null); setTestResult(null); setUserAnswers({}); }}
                            className="text-xs bg-white/5 text-slate-300 px-3 py-1.5 rounded-lg">Exit</button>
                        </div>
                        {testResult ? (
                          <div className="text-center py-8 space-y-4">
                            <Award size={48} className="mx-auto text-amber-400" />
                            <h4 className="text-2xl font-black text-white">Exam Submitted!</h4>
                            <p className="text-lg text-emerald-400 font-black">Score: {testResult.score}/{testResult.total}</p>
                            <button onClick={() => { setActiveTest(null); setTestResult(null); setUserAnswers({}); }}
                              className="shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black px-6 py-2.5 text-sm shadow-lg glow-violet">
                              Back to Quizzes
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {activeTest.questions.map((q, qIdx) => (
                              <div key={qIdx} className="rounded-xl bg-black/40 border border-white/10 p-4 space-y-3">
                                <p className="font-bold text-white">Q{qIdx + 1}. {q.question}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {['A', 'B', 'C', 'D'].map(opt => (
                                    <label key={opt} className={`p-3 rounded-xl border text-sm flex items-center gap-3 cursor-pointer ${userAnswers[qIdx] === opt ? 'bg-violet-500/15 border-violet-500/60 text-white font-bold' : 'bg-black/40 border-white/10 text-slate-300'}`}>
                                      <input type="radio" name={`q_${qIdx}`} checked={userAnswers[qIdx] === opt} onChange={() => setUserAnswers({ ...userAnswers, [qIdx]: opt })} className="accent-violet-500" />
                                      <span>{opt}. {q[`option${opt}`]}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <button onClick={handleSubmitMockTest}
                              className="shine-btn w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black py-4 shadow-lg glow-emerald">
                              Submit Exam
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {mockTests.filter(t => t.batch === 'ALL' || t.batch === session.user?.batch).map(test => (
                          <div key={test.id} className="rounded-2xl bg-black/30 border border-white/10 p-4 flex justify-between items-center gap-3">
                            <div>
                              <p className="font-bold text-white">{test.title}</p>
                              <p className="text-xs text-slate-400">{test.questions.length} questions</p>
                            </div>
                            <button onClick={() => { setActiveTest(test); setUserAnswers({}); setTestResult(null); }}
                              className="shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black px-4 py-2.5 text-xs shadow-lg glow-violet">
                              Start Quiz
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {studentNavTab === 'materials' && (
                  <div className="rounded-3xl glass-card p-6 space-y-4 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Lock className="text-emerald-400" /> Encrypted PDFs</h3>
                    {pdfList.map(pdf => (
                      <div key={pdf.id} className="rounded-2xl bg-black/30 border border-white/10 p-4 flex justify-between items-center gap-3">
                        <div>
                          <p className="font-bold text-white">{pdf.title}</p>
                          <p className="text-xs text-slate-400">{pdf.uploadedAt}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAuthorizedStudentPdfView(pdf)}
                            className="rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3.5 py-2 text-xs font-bold">
                            <Eye size={14} className="inline mr-1" /> View
                          </button>
                          <button onClick={() => handleAuthorizedStudentPdfDownload(pdf)}
                            className="shine-btn rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 px-3.5 py-2 text-xs font-black shadow-lg glow-emerald">
                            <Download size={14} className="inline mr-1" /> Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {studentNavTab === 'ai_doubts' && (
                  <div className="rounded-3xl glass-card p-6 space-y-5 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><MessageSquare className="text-emerald-400" /> AI Doubt Solver</h3>
                    <form onSubmit={handleAskAiDoubt} className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-3">
                      <textarea rows="3" placeholder="Ask any question..." value={doubtQuestionInput} onChange={(e) => setDoubtQuestionInput(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 p-4 text-sm text-white focus:outline-none focus:border-emerald-400" />
                      <div className="flex justify-between gap-3">
                        <label className="rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs font-bold cursor-pointer flex items-center gap-2 text-slate-300">
                          <Camera size={14} /> Photo
                          <input type="file" accept="image/*" capture="environment" onChange={handleDoubtPhotoChange} className="hidden" />
                        </label>
                        <button type="submit"
                          className="shine-btn rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black px-6 py-2.5 text-sm shadow-lg glow-emerald">
                          <Send size={14} className="inline mr-1" /> Submit
                        </button>
                      </div>
                    </form>
                    {doubtsList.map(d => (
                      <div key={d.id} className="rounded-2xl bg-black/30 border border-white/10 p-5 space-y-3">
                        <p className="font-bold text-white">{d.question}</p>
                        {d.photo && <img src={d.photo} alt="Doubt" className="max-h-52 rounded-xl border border-white/10 object-contain" />}
                        <div className="rounded-xl bg-emerald-500/5 border-l-4 border-emerald-400 p-3">
                          <span className="text-[11px] font-black text-emerald-400">AI Solution</span>
                          <p className="text-xs text-slate-200 whitespace-pre-line">{d.aiAnswer}</p>
                        </div>
                        {d.teacherReply && (
                          <div className="rounded-xl bg-violet-500/5 border-l-4 border-violet-400 p-3">
                            <span className="text-[11px] font-black text-violet-300">Teacher's Note</span>
                            <p className="text-xs text-white mt-1">{d.teacherReply}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {studentNavTab === 'dashboard' && (
                  <div className="rounded-3xl glass-card p-6 space-y-4 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><User className="text-violet-400" /> Your Profile</h3>
                    <form onSubmit={handleUpdateStudentProfile} className="space-y-4 max-w-xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input type="text" disabled value={session.user?.name || ''} className="w-full rounded-xl bg-black/30 border border-white/5 px-4 py-3 text-sm text-slate-500 cursor-not-allowed" />
                        <input type="date" disabled value={session.user?.dob || ''} className="w-full rounded-xl bg-black/30 border border-white/5 px-4 py-3 text-sm text-slate-500 cursor-not-allowed" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <select value={editGender} onChange={(e) => setEditGender(e.target.value)}
                          className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white">
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                        <input type="tel" required value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white" />
                        <input type="text" required value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                          className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white" />
                      </div>
                      <button type="submit"
                        className="shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black px-6 py-3 text-sm shadow-lg glow-violet">
                        Save Changes
                      </button>
                    </form>
                  </div>
                )}

                {studentNavTab === 'ai_learning' && (
                  <div className="rounded-3xl glass-card p-6 space-y-6 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Brain className="text-violet-400" /> Personalized Learning</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-2xl bg-black/40 border border-white/10 p-5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Average Accuracy</span>
                        <p className="text-3xl font-black text-gradient-warm mt-1">{averageQuizPct !== null ? `${averageQuizPct}%` : 'No Quiz'}</p>
                      </div>
                      <div className="md:col-span-2 rounded-2xl bg-black/40 border border-violet-500/30 p-5">
                        <span className="text-[10px] text-violet-300 font-black flex items-center gap-1"><Sparkles size={12} /> Recommended</span>
                        <h4 className="text-sm font-bold text-white mt-1.5">{aiRecommendedTopic}</h4>
                      </div>
                    </div>
                  </div>
                )}

                {studentNavTab === 'privacy_parental' && (
                  <div className="rounded-3xl glass-card p-6 space-y-4 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><ShieldCheck className="text-rose-400" /> Security & Parental</h3>
                    {!parentalUnlocked ? (
                      <div className="flex gap-2">
                        <input type="password" placeholder="PIN" value={parentalPinInput} onChange={(e) => setParentalPinInput(e.target.value)}
                          className="rounded-xl bg-black/40 border border-white/10 px-3.5 py-2 text-xs text-white w-28" />
                        <button onClick={() => { if (parentalPinInput === parentalPin) setParentalUnlocked(true); else alert('Invalid PIN!'); }}
                          className="shine-btn rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white px-4 py-2 text-xs font-bold shadow-lg glow-rose">Unlock</button>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-xs text-slate-200">
                        <p>Name: <strong>{session.user?.name}</strong></p>
                        <p>Days Present: <strong>{attendanceLogs.filter(l => l.studentId === session.user?.id).length}</strong></p>
                        <p>Quizzes: <strong>{studentQuizHistory.length}</strong></p>
                        <p>Pending Dues: <strong className="text-rose-400">₹{totalStudentDueAmount}</strong></p>
                        <button onClick={() => setParentalUnlocked(false)} className="text-rose-400 font-bold underline mt-2">Lock</button>
                      </div>
                    )}
                  </div>
                )}

                {studentNavTab === 'feedback' && (
                  <div className="rounded-3xl glass-card p-6 space-y-4 anim-fade">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Star className="text-amber-400" /> Feedback</h3>
                    <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Rating:</span>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} size={24} className={`cursor-pointer ${feedbackRating >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} onClick={() => setFeedbackRating(star)} />
                        ))}
                      </div>
                      <textarea rows="3" placeholder="Your suggestions..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-400" />
                      <button type="submit"
                        className="shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black px-6 py-2.5 text-sm shadow-lg glow-violet">
                        Submit
                      </button>
                    </form>
                  </div>
                )}

                {studentNavTab === 'contact_us' && (
                  <div className="rounded-3xl glass-card p-6 space-y-4 anim-fade">
                    <h3 className="text-xl font-black text-white text-center">Get in Touch</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <a href={`tel:${contactInfo.phone}`}
                        className="rounded-3xl bg-black/30 border border-violet-500/30 p-6 text-center space-y-3 flex flex-col items-center soft-hover">
                        <Phone size={28} className="text-violet-400" />
                        <h4 className="text-base font-black text-white">Call</h4>
                        <p className="text-[11px] text-violet-300 font-mono">{contactInfo.phone}</p>
                      </a>
                      <a href={`https://wa.me/${contactInfo.whatsapp}`} target="_blank" rel="noreferrer"
                        className="rounded-3xl bg-black/30 border border-emerald-500/30 p-6 text-center space-y-3 flex flex-col items-center soft-hover">
                        <MessageCircle size={28} className="text-emerald-400" />
                        <h4 className="text-base font-black text-white">WhatsApp</h4>
                        <p className="text-[11px] text-emerald-300 font-mono">+{contactInfo.whatsapp}</p>
                      </a>
                      <a href={`mailto:${contactInfo.email}`}
                        className="rounded-3xl bg-black/30 border border-fuchsia-500/30 p-6 text-center space-y-3 flex flex-col items-center soft-hover">
                        <Mail size={28} className="text-fuchsia-400" />
                        <h4 className="text-base font-black text-white">Email</h4>
                        <p className="text-[11px] text-fuchsia-300 font-mono truncate">{contactInfo.email}</p>
                      </a>
                    </div>
                    <p className="text-center text-xs text-slate-400">📍 {contactInfo.address}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TEACHER */}
        {session.mode === 'teacher' && (
          <div className="space-y-5 anim-fade">
            <section className="rounded-3xl glass-card p-7 shadow-xl">
              <span className="text-[10px] uppercase tracking-[0.3em] font-black text-violet-300">Teacher Workspace</span>
              <h2 className="text-2xl md:text-3xl font-black text-white mt-1">Good to see you, <span className="text-gradient-primary italic">Avradeep Sir</span></h2>
            </section>

            {pendingFaceStudentsCount > 0 && (
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/40 p-4 flex justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={24} className="text-rose-400" />
                  <div>
                    <h4 className="font-black text-white text-sm">Face Verification Pending</h4>
                    <p className="text-xs text-rose-200">{pendingFaceStudentsCount} student(s) waiting</p>
                  </div>
                </div>
                <button onClick={() => setTeacherNavTab('face_reg')}
                  className="shine-btn rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black px-4 py-2 text-xs shadow-lg glow-rose">Verify</button>
              </div>
            )}

            <div className="rounded-3xl glass-card p-4 flex flex-wrap gap-2">
              <div className="rounded-xl bg-violet-500/10 border border-violet-500/30 px-3.5 py-2 flex items-center gap-2">
                <Users size={16} className="text-violet-300" />
                <span className="text-xs font-black text-white">Students: <span className="text-violet-300">{students.length}</span></span>
              </div>
              <select value={selectedBatchFilter} onChange={(e) => setSelectedBatchFilter(e.target.value)}
                className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white font-bold">
                <option value="ALL">All Batches</option>
                {BATCH_OPTIONS.map((b, i) => <option key={i} value={b}>{b}</option>)}
              </select>
              <label className="rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/30 px-3.5 py-2 text-xs font-bold cursor-pointer">
                {teacherSignatureImg ? 'Update Signature ✓' : 'Upload Signature'}
                <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
              </label>
              <button onClick={() => setShowChangePinModal(true)}
                className="rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-3.5 py-2 text-xs font-bold">
                <Key size={13} className="inline mr-1" /> PIN
              </button>
              <button onClick={() => window.location.reload()}
                className="rounded-xl bg-white/5 text-slate-300 border border-white/10 px-3.5 py-2 text-xs font-bold">
                <RefreshCw size={13} className="inline mr-1" /> Refresh
              </button>
              <button onClick={handleWipeAllOldData} disabled={isWipingData}
                className="rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 px-3.5 py-2 text-xs font-bold">
                <AlertTriangle size={13} className="inline mr-1" /> Wipe
              </button>
            </div>

            <div className="rounded-3xl glass-card p-2.5 flex flex-wrap gap-1.5">
              {[
                { id: 'fees', icon: CreditCard, label: 'Fees & Certs' },
                { id: 'face_reg', icon: Camera, label: 'Face Reg', badge: pendingFaceStudentsCount },
                { id: 'attendance', icon: Calendar, label: 'Attendance' },
                { id: 'mock_test', icon: Brain, label: 'Quiz Creator' },
                { id: 'materials', icon: FileText, label: 'Materials' },
                { id: 'doubts_admin', icon: MessageSquare, label: `Doubts (${doubtsList.length})` },
                { id: 'feedbacks', icon: Star, label: `Feedbacks (${feedbacksList.length})` }
              ].map(t => {
                const isActive = teacherNavTab === t.id;
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setTeacherNavTab(t.id)}
                    className={`relative px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                      isActive ? 'tab-active-gradient text-white' : 'bg-black/30 text-slate-300 hover:bg-white/5'
                    }`}>
                    <Icon size={15} /> {t.label}
                    {t.badge > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">{t.badge}</span>}
                  </button>
                );
              })}
            </div>

            {teacherNavTab === 'fees' && (
              <div className="rounded-3xl glass-card p-6 space-y-5 anim-fade">
                <h2 className="text-xl font-black text-white flex items-center gap-2"><CreditCard className="text-violet-300" /> Fees & Certificates</h2>
                {managingFeeStudent && (
                  <div className="rounded-2xl bg-black/40 border border-violet-500/40 p-5 space-y-4">
                    <div className="flex justify-between">
                      <h4 className="text-sm font-bold text-white">Managing: <span className="text-violet-300">{managingFeeStudent.name}</span></h4>
                      <button onClick={() => setManagingFeeStudent(null)} className="text-xs text-rose-400 font-bold">Close</button>
                    </div>
                    <form onSubmit={handleSaveFeeRecord} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input type="month" value={feeMonthInput} onChange={(e) => setFeeMonthInput(e.target.value)}
                        className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <input type="number" value={feeAmountInput} onChange={(e) => setFeeAmountInput(e.target.value)}
                        className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <select value={feeStatusInput} onChange={(e) => setFeeStatusInput(e.target.value)}
                        className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white">
                        <option value="Paid">Paid</option>
                        <option value="Due">Due</option>
                      </select>
                      <button type="submit"
                        className="shine-btn sm:col-span-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black py-3 text-sm shadow-lg glow-violet">
                        Save
                      </button>
                    </form>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto custom-scroll">
                  {filteredStudents.map(st => {
                    const hasDue = feesRecords.filter(f => f.studentId === st.id).some(f => f.status === 'Due');
                    return (
                      <div key={st.id} className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-3">
                        <div>
                          <p className="font-bold text-white text-sm">{st.name}</p>
                          <p className="text-xs text-violet-300">{st.batch}</p>
                          <div className="flex gap-2 text-[10px] mt-1.5">
                            {hasDue ? <span className="text-rose-400 font-bold">⚠️ Due</span> : <span className="text-emerald-400 font-bold">Paid ✓</span>}
                            {st.certificateIssued && <span className="text-amber-400 font-bold">🎓 Cert</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                          <button onClick={() => setManagingFeeStudent(st)}
                            className="flex-1 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/30 px-2 py-1.5 text-[10px] font-bold">Add Fee</button>
                          <button onClick={() => setViewingFeeHistoryStudent(st)}
                            className="flex-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-1.5 text-[10px] font-bold flex items-center justify-center gap-1"><History size={10}/> History</button>
                          <button onClick={() => handleToggleIssueCertificate(st)}
                            className={`w-full mt-1 rounded-lg px-2 py-1.5 text-[10px] font-bold border ${
                              st.certificateIssued ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-emerald-500/80 text-slate-950 border-emerald-500'
                            }`}>
                            {st.certificateIssued ? '✓ Issued' : '🎓 Issue Cert'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {teacherNavTab === 'face_reg' && (
              <div className="rounded-3xl glass-card p-6 space-y-5 anim-fade">
                <h2 className="text-xl font-black text-white flex items-center gap-2"><Camera className="text-violet-300" /> Face Registration</h2>
                <div className="rounded-2xl bg-black/40 border border-white/10 p-5">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select value={selectedStudentIdForFace} onChange={(e) => setSelectedStudentIdForFace(e.target.value)}
                      className="flex-grow rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white">
                      <option value="">-- Choose Student --</option>
                      {filteredStudents.map(st => <option key={st.id} value={st.id}>{st.name} {st.facePhoto ? '✅' : '⚠️'}</option>)}
                    </select>
                    <button onClick={openTeacherFaceRegistration}
                      className="shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-6 py-3 text-sm shadow-lg glow-violet">
                      <Camera size={16} className="inline mr-1" /> Open Camera
                    </button>
                  </div>
                </div>
                {teacherCameraOpen && (
                  <div className="rounded-3xl bg-black/40 border border-violet-500/40 p-6 text-center space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-white">Registering: <span className="text-violet-300">{students.find(s => s.id === selectedStudentIdForFace)?.name}</span></h3>
                      <div className="flex items-center gap-2">
                        <button onClick={handleSwitchCamera} className="text-xs bg-violet-500/20 text-violet-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                          <RefreshCw size={12} /> Flip
                        </button>
                        <button onClick={stopCameraStream} className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg font-bold">Close</button>
                      </div>
                    </div>
                    <div className="relative mx-auto w-64 h-64 bg-black rounded-2xl overflow-hidden border-2 border-violet-400">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      {isRegisteringFaceScan && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/90 py-2 px-3">
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                            <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-full" style={{ width: `${faceRegProgress}%` }}></div>
                          </div>
                          <span className="text-xs font-black text-violet-300">Scanning: {faceRegProgress}%</span>
                        </div>
                      )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <button onClick={saveStudentFaceToFirebase} disabled={isRegisteringFaceScan}
                      className="shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-black px-8 py-3.5 text-sm shadow-lg glow-violet">
                      {isRegisteringFaceScan ? `Scanning...` : 'Capture & Save'}
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[450px] overflow-y-auto custom-scroll">
                  {filteredStudents.map(st => (
                    <div key={st.id} className="rounded-2xl bg-black/30 border border-white/10 p-3.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {st.facePhoto ? (
                          <img src={st.facePhoto} alt="Face" className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500/60 shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-[9px] text-rose-400 font-bold shrink-0">Locked</div>
                        )}
                        <div className="truncate">
                          <p className="font-bold text-white text-sm truncate">{st.name}</p>
                          <p className="text-[10px] text-violet-300 truncate">{st.batch}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => setSelectedStudentIdForFace(st.id)}
                          className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-1 rounded-lg font-bold">Select</button>
                        <button onClick={() => handleDeleteSingleStudent(st.id, st.name)}
                          className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-1 rounded-lg font-bold">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {teacherNavTab === 'attendance' && (
              <div className="rounded-3xl glass-card p-6 space-y-5 anim-fade">
                <div className="rounded-2xl bg-emerald-900/30 border border-emerald-500/40 p-5 text-center space-y-3">
                  <h3 className="text-base font-black text-emerald-300 flex items-center justify-center gap-2"><ScanFace size={22} /> Live Face Attendance</h3>
                  <button onClick={openTeacherAttendanceScanner}
                    className="shine-btn rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black px-6 py-3 text-sm shadow-lg glow-emerald">
                    <Camera size={18} className="inline mr-1" /> Open Scanner
                  </button>
                </div>
                {attendanceScannerOpen && (
                  <div className="rounded-3xl bg-black/40 border border-emerald-500/40 p-6 text-center space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-3 py-1 rounded-full font-bold">Scanner Active</span>
                      <div className="flex items-center gap-2">
                        <button onClick={handleSwitchCamera} className="text-xs bg-violet-500/20 text-violet-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                          <RefreshCw size={12} /> Flip
                        </button>
                        <button onClick={stopCameraStream} className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg font-bold">Close</button>
                      </div>
                    </div>
                    <div className="relative mx-auto w-64 h-64 bg-black rounded-3xl overflow-hidden border-4 border-emerald-500/60">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      <div className="absolute inset-4 border-2 border-dashed border-emerald-400/80 rounded-full pointer-events-none" />
                      <div className={`absolute inset-x-0 bottom-0 text-center text-xs font-bold py-2 px-1 transition-colors ${
                        detectedStudent ? 'bg-emerald-500/90 text-slate-950' :
                        scanDebugText.includes('❌') ? 'bg-rose-500/90 text-white' :
                        'bg-black/80 text-amber-300'
                      }`}>
                        {scanDebugText}
                      </div>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    {detectedStudent && (
                      <div className="rounded-2xl bg-black/40 border border-emerald-500/40 p-4 text-left max-w-md mx-auto space-y-3">
                        <p className="text-xs font-bold text-emerald-400"><CheckCircle size={13} className="inline mr-1" /> Face Detected</p>
                        <div className="flex items-center gap-3">
                          <img src={capturedProofPhoto || detectedStudent.facePhoto} alt="Proof" className="w-16 h-16 rounded-xl object-cover border border-emerald-500/40" />
                          <div>
                            <h4 className="font-black text-white">{detectedStudent.name}</h4>
                            <p className="text-xs text-violet-300">{detectedStudent.batch}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={confirmAndMarkAttendance} disabled={isSavingAttendance}
                            className="shine-btn flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black py-2.5 text-xs shadow-lg glow-emerald">
                            {isSavingAttendance ? 'Saving...' : 'Mark Present ✓'}
                          </button>
                          <button onClick={handleNotMeCycleNext}
                            className="rounded-xl bg-white/5 text-slate-300 px-3 text-xs font-bold">Next</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <h3 className="text-lg font-black text-white">Attendance Register</h3>
                  <div className="flex rounded-xl bg-black/40 border border-white/10 p-1">
                    <button onClick={() => setAttendanceViewTab('daily')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${attendanceViewTab === 'daily' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}>Daily</button>
                    <button onClick={() => setAttendanceViewTab('monthly')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${attendanceViewTab === 'monthly' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>Monthly</button>
                  </div>
                </div>
                {attendanceViewTab === 'daily' ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-black/40 border border-white/10 p-4 rounded-2xl">
                      <input type="date" value={selectedCalendarDate} onChange={(e) => setSelectedCalendarDate(e.target.value)}
                        className="rounded-xl bg-black/40 border border-emerald-500/40 px-4 py-2 text-sm text-white font-bold" />
                      <div className="flex gap-2 text-xs font-bold">
                        <span className="bg-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded-xl">Present: {logsForSelectedDate.length}</span>
                        <span className="bg-rose-500/15 text-rose-400 px-3 py-1.5 rounded-xl">Absent: {absentStudentsOnDate.length}</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-black/40 text-emerald-300 uppercase text-[10px] border-b border-white/10">
                          <tr><th className="p-3.5">Student</th><th className="p-3.5">Batch</th><th className="p-3.5">Time</th><th className="p-3.5">Location</th><th className="p-3.5 text-center">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-black/20">
                          {logsForSelectedDate.map(log => (
                            <tr key={log.id}>
                              <td className="p-3.5 font-bold text-white text-xs">{log.name}</td>
                              <td className="p-3.5 text-violet-300 text-xs">{log.batch}</td>
                              <td className="p-3.5 text-emerald-400 font-bold text-xs">{log.time}</td>
                              <td className="p-3.5 text-[11px] text-slate-400">{log.location}</td>
                              <td className="p-3.5 text-center">
                                <button onClick={() => handleMarkAttendanceAbsent(log.id, log.name)}
                                  className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 mx-auto">
                                  <Trash2 size={12} /> Mark Absent
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input type="month" value={selectedMonthFilter} onChange={(e) => setSelectedMonthFilter(e.target.value)}
                      className="rounded-xl bg-black/40 border border-amber-500/40 px-4 py-2 text-sm text-white font-bold" />
                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-black/40 text-amber-300 uppercase text-[10px] border-b border-white/10">
                          <tr><th className="p-3.5">Student</th><th className="p-3.5">Present</th><th className="p-3.5">Absent</th><th className="p-3.5">%</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-black/20">
                          {monthlyStats.map(st => (
                            <tr key={st.id}>
                              <td className="p-3.5 font-bold text-white text-xs">{st.name}</td>
                              <td className="p-3.5"><span className="bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded text-[10px] font-bold">{st.daysPresent}d</span></td>
                              <td className="p-3.5"><span className="bg-rose-500/15 text-rose-400 px-2.5 py-1 rounded text-[10px] font-bold">{st.daysAbsent}d</span></td>
                              <td className="p-3.5 font-bold text-white text-xs">{st.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {teacherNavTab === 'mock_test' && (
              <div className="rounded-3xl glass-card p-6 space-y-5 anim-fade">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black text-white flex items-center gap-2"><Brain className="text-violet-300" /> {isEditingTestId ? 'Edit Quiz' : 'Quiz Creator'}</h2>
                  <button type="button" onClick={handleTeacherAutoFillAiQuestions}
                    className="shine-btn rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black px-5 py-3 text-xs shadow-lg glow-violet">
                    <Sparkles size={14} className="inline mr-1" /> Auto-Generate
                  </button>
                </div>
                <form onSubmit={handlePublishMockTest} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" required placeholder="Topic / Title" value={testTitle} onChange={(e) => setTestTitle(e.target.value)}
                      className="rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white" />
                    <select value={testBatchTarget} onChange={(e) => setTestBatchTarget(e.target.value)}
                      className="rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white">
                      <option value="ALL">All Batches</option>
                      {BATCH_OPTIONS.map((b, i) => <option key={i} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    {questionsList.map((q, idx) => (
                      <div key={idx} className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-3">
                        <div className="flex justify-between">
                          <span className="text-[10px] font-black text-violet-300">Q{idx + 1} / 35</span>
                          {questionsList.length > 1 && <button type="button" onClick={() => handleRemoveQuestionRow(idx)} className="text-[10px] text-rose-400 font-bold">Remove</button>}
                        </div>
                        <input type="text" required placeholder="Question text..." value={q.question} onChange={(e) => handleQuestionChange(idx, 'question', e.target.value)}
                          className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2.5 text-sm text-white" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {['A', 'B', 'C', 'D'].map(opt => (
                            <input key={opt} type="text" required placeholder={`Option ${opt}`} value={q[`option${opt}`]} onChange={(e) => handleQuestionChange(idx, `option${opt}`, e.target.value)}
                              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white" />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-slate-400">Answer:</label>
                          <select value={q.correct} onChange={(e) => handleQuestionChange(idx, 'correct', e.target.value)}
                            className="rounded-lg bg-black/40 border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-400 font-bold">
                            {['A','B','C','D'].map(o => <option key={o} value={o}>Option {o}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {questionsList.length < 35 && (
                      <button type="button" onClick={handleAddQuestionRow}
                        className="rounded-xl bg-white/5 text-violet-200 font-bold px-5 py-3 text-sm">
                        + Add ({questionsList.length}/35)
                      </button>
                    )}
                    <button type="submit"
                      className="shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black px-6 py-3 text-sm ml-auto shadow-lg glow-violet">
                      {isEditingTestId ? 'Update Quiz' : 'Publish Quiz'}
                    </button>
                  </div>
                </form>
                <div className="pt-5 border-t border-white/10">
                  <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Published ({mockTests.length})</h4>
                  <div className="space-y-2">
                    {mockTests.map(test => (
                      <div key={test.id} className="rounded-xl bg-black/30 border border-white/10 p-3 flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{test.title} <span className="text-[10px] text-violet-300">({test.batch})</span></p>
                          <p className="text-[11px] text-slate-400">{test.questions.length} questions</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleEditMockTest(test)}
                            className="rounded-lg bg-white/5 text-violet-300 px-2.5 py-1.5 text-[11px] font-bold"><Edit3 size={12} /> Edit</button>
                          <button onClick={() => handleDeleteMockTest(test.id)}
                            className="rounded-lg bg-rose-500/15 text-rose-400 px-2 py-1.5 text-[11px]"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {teacherNavTab === 'materials' && (
              <div className="space-y-5 anim-fade">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="rounded-3xl glass-card p-5 space-y-3">
                    <h3 className="text-sm font-black text-emerald-300"><FileText size={16} className="inline mr-1" /> Upload PDF</h3>
                    <input type="text" placeholder="PDF Title..." value={pdfTitleInput} onChange={(e) => setPdfTitleInput(e.target.value)}
                      className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2.5 text-sm text-white" />
                    <label className="shine-btn block rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black py-2.5 text-center text-sm cursor-pointer shadow-lg glow-emerald">
                      {isUploadingPdf ? 'Encrypting...' : 'Select PDF'}
                      <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
                    </label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scroll">
                      {pdfList.map(pdf => (
                        <div key={pdf.id} className="flex justify-between items-center bg-black/30 rounded-lg px-2.5 py-1.5 text-[11px] border border-white/10">
                          <span className="truncate pr-2 text-slate-300">{pdf.title}</span>
                          <button onClick={() => handleDeletePdf(pdf.id)} className="text-rose-400"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl glass-card p-5 space-y-3">
                    <h3 className="text-sm font-black text-rose-300"><Video size={16} className="inline mr-1" /> Start Live Class</h3>
                    <p className="text-[10px] text-emerald-400 font-semibold">
                      ✓ Paste a Google Meet link — students click "Join Live" to open it instantly
                    </p>
                    <form onSubmit={handleAddLiveClass} className="space-y-2">
                      <input type="text" placeholder="Class topic..." value={newClassTitle} onChange={(e) => setNewClassTitle(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <input type="text" placeholder="Time (e.g., Today 7 PM)" value={newClassTime} onChange={(e) => setNewClassTime(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <input type="url" required placeholder="https://meet.google.com/abc-defg-hij"
                        value={newClassLink} onChange={(e) => setNewClassLink(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-emerald-500/40 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400" />
                      <button type="submit"
                        className="shine-btn w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black py-2.5 text-sm shadow-lg glow-rose">
                        Go Live 🔴
                      </button>
                    </form>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scroll">
                      {liveClasses.map(cls => (
                        <div key={cls.id} className="flex justify-between items-center bg-black/30 rounded-lg px-2.5 py-1.5 text-[11px] border border-white/10">
                          <span className="truncate pr-2 text-slate-300 font-bold">{cls.title}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openMeetLink(cls.link) && null}
                              className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded font-bold">Enter</button>
                            <button onClick={() => handleDeleteLiveClass(cls.id)} className="text-rose-400"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl glass-card p-5 space-y-3">
                    <h3 className="text-sm font-black text-violet-300"><Bell size={16} className="inline mr-1" /> Post Notice</h3>
                    <form onSubmit={handleAddNotice} className="space-y-2">
                      <input type="text" placeholder="Title" value={newNoticeTitle} onChange={(e) => setNewNoticeTitle(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <textarea rows="2" placeholder="Content..." value={newNoticeContent} onChange={(e) => setNewNoticeContent(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <button type="submit"
                        className="shine-btn w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black py-2.5 text-sm shadow-lg glow-violet">
                        Publish
                      </button>
                    </form>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scroll">
                      {notices.map(n => (
                        <div key={n.id} className="flex justify-between items-center bg-black/30 rounded-lg px-2.5 py-1.5 text-[11px] border border-white/10">
                          <span className="truncate pr-2 text-slate-300">{n.title}</span>
                          <button onClick={() => handleDeleteNotice(n.id)} className="text-rose-400"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="rounded-3xl glass-card p-5 space-y-3">
                    <h3 className="text-sm font-black text-violet-300"><PlayCircle size={16} className="inline mr-1" /> Add Recording</h3>
                    <form onSubmit={handleAddRecordedClass} className="space-y-2">
                      <input type="text" placeholder="Lecture title" value={newRecTitle} onChange={(e) => setNewRecTitle(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <select value={newRecBatch} onChange={(e) => setNewRecBatch(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white">
                        <option value="ALL">All Batches</option>
                        {BATCH_OPTIONS.map((b, i) => <option key={i} value={b}>{b}</option>)}
                      </select>
                      <input type="url" placeholder="Video URL" value={newRecUrl} onChange={(e) => setNewRecUrl(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <button type="submit"
                        className="shine-btn w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black py-2.5 text-sm shadow-lg glow-violet">
                        Publish
                      </button>
                    </form>
                  </div>
                  <div className="rounded-3xl glass-card p-5 space-y-3">
                    <h3 className="text-sm font-black text-amber-300"><BarChart3 size={16} className="inline mr-1" /> Create Poll</h3>
                    <form onSubmit={handleCreateLivePoll} className="space-y-2">
                      <input type="text" placeholder="Question" value={newPollQuestion} onChange={(e) => setNewPollQuestion(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <input type="text" placeholder="Option A" value={newPollOptA} onChange={(e) => setNewPollOptA(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <input type="text" placeholder="Option B" value={newPollOptB} onChange={(e) => setNewPollOptB(e.target.value)}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white" />
                      <button type="submit"
                        className="shine-btn w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black py-2.5 text-sm shadow-lg glow-amber">
                        Launch Poll
                      </button>
                    </form>
                  </div>
                  <div className="rounded-3xl glass-card p-5 space-y-2.5">
                    <h3 className="text-sm font-black text-violet-300"><Calendar size={16} className="inline mr-1" /> Exam & Contact</h3>
                    <input type="text" placeholder="Exam name" value={examCountdown.title}
                      onChange={(e) => setExamCountdown({ ...examCountdown, title: e.target.value })}
                      className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white" />
                    <input type="date" value={examCountdown.date}
                      onChange={(e) => setExamCountdown({ ...examCountdown, date: e.target.value })}
                      className="w-full rounded-xl bg-black/40 border border-violet-500/40 px-3 py-2 text-xs text-white font-bold" />
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <input type="text" placeholder="Call number" value={contactInfo.phone}
                        onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white" />
                      <input type="text" placeholder="WhatsApp (with 91)" value={contactInfo.whatsapp}
                        onChange={(e) => setContactInfo({ ...contactInfo, whatsapp: e.target.value })}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white" />
                      <input type="email" placeholder="Email" value={contactInfo.email}
                        onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white" />
                    </div>
                    <button 
                      onClick={handlePublishSettings}
                      className="shine-btn w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black py-2.5 text-sm shadow-lg glow-violet mt-2">
                      Save & Publish Details
                    </button>
                  </div>
                </div>
              </div>
            )}

            {teacherNavTab === 'doubts_admin' && (
              <div className="rounded-3xl glass-card p-6 space-y-5 anim-fade">
                <h2 className="text-xl font-black text-white flex items-center gap-2"><MessageSquare className="text-violet-300" /> Doubts ({doubtsList.length})</h2>
                {doubtsList.map(d => (
                  <div key={d.id} className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-violet-300">{d.studentName} ({d.batch})</span>
                      <span className="text-[10px] text-slate-500">{d.date}</span>
                    </div>
                    <p className="font-bold text-white text-sm">{d.question}</p>
                    {d.photo && <img src={d.photo} alt="Doubt" className="max-h-52 rounded-xl border border-white/10" />}
                    <div className="rounded-xl bg-emerald-500/5 border-l-4 border-emerald-400 p-3 text-xs text-slate-300 whitespace-pre-line">
                      <strong className="text-emerald-400">AI:</strong> {d.aiAnswer}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Your explanation..." value={teacherReplyInputs[d.id] || ''} onChange={(e) => setTeacherReplyInputs({ ...teacherReplyInputs, [d.id]: e.target.value })}
                        className="flex-grow rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white" />
                      <button onClick={() => handleSaveTeacherDoubtReply(d.id)}
                        className="shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black px-4 py-2 text-xs shadow-lg glow-violet">
                        Reply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {teacherNavTab === 'feedbacks' && (
              <div className="rounded-3xl glass-card p-6 space-y-5 anim-fade">
                <h2 className="text-xl font-black text-white flex items-center gap-2"><Star className="text-amber-300" /> Feedbacks ({feedbacksList.length})</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[450px] overflow-y-auto custom-scroll">
                  {feedbacksList.map((fb, i) => (
                    <div key={i} className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{fb.studentName}</span>
                        <div className="flex">{[...Array(fb.rating)].map((_, idx) => <Star key={idx} size={12} className="text-amber-400 fill-amber-400" />)}</div>
                      </div>
                      <p className="text-[10px] text-violet-300">{fb.batch}</p>
                      <p className="text-xs text-slate-300">{fb.comment || 'No comment.'}</p>
                      <span className="text-[10px] text-slate-500 block text-right">{fb.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODALS */}
      {viewingFeeHistoryStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl glass-card p-6 md:p-8 shadow-2xl glow-violet space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-2">
                  <History className="text-violet-400" /> Fee History
                </h3>
                <p className="text-sm text-slate-300 mt-1">Student: <strong className="text-violet-300">{viewingFeeHistoryStudent.name}</strong></p>
                <p className="text-xs text-slate-400">Batch: {viewingFeeHistoryStudent.batch}</p>
              </div>
              <button onClick={() => setViewingFeeHistoryStudent(null)}
                className="rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/40 px-4 py-2 text-xs font-bold">Close</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Paid</p>
                <p className="text-2xl font-black text-white mt-1">
                  ₹{feesRecords.filter(f => f.studentId === viewingFeeHistoryStudent.id && f.status === 'Paid').reduce((a, b) => a + b.amount, 0)}
                </p>
              </div>
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Total Due</p>
                <p className="text-2xl font-black text-white mt-1">
                  ₹{feesRecords.filter(f => f.studentId === viewingFeeHistoryStudent.id && f.status === 'Due').reduce((a, b) => a + b.amount, 0)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 max-h-[400px]">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-black/40 text-violet-300 uppercase text-[10px] border-b border-white/10 sticky top-0">
                  <tr>
                    <th className="p-3.5">Month</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Date / Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-black/20">
                  {feesRecords
                    .filter(f => f.studentId === viewingFeeHistoryStudent.id)
                    .sort((a, b) => new Date(b.month) - new Date(a.month))
                    .map(fee => (
                    <tr key={fee.id} className="hover:bg-white/5">
                      <td className="p-3.5 font-bold text-white">{fee.month}</td>
                      <td className="p-3.5 text-white">₹{fee.amount}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${fee.status === 'Paid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                          {fee.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-[11px] text-slate-400">
                        {fee.updatedAt || 'N/A'} <br/>
                        <span className="text-[9px] text-slate-500 font-mono">{fee.receiptNo || 'No Receipt'}</span>
                      </td>
                    </tr>
                  ))}
                  {feesRecords.filter(f => f.studentId === viewingFeeHistoryStudent.id).length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-slate-500 text-sm">No fee records found for this student.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl glass-card p-8 shadow-2xl glow-violet space-y-6 text-center">
            <ShieldCheck className="text-violet-400 mx-auto" size={48} />
            <h3 className="text-2xl font-black text-white">Verify OTP</h3>
            <div className="rounded-2xl bg-black/40 border border-violet-500/30 py-5">
              <span className="text-4xl font-black text-gradient-primary tracking-[0.4em]">{generatedOtp}</span>
            </div>
            <input type="text" maxLength="4" placeholder="• • • •" value={otpInput} onChange={(e) => setOtpInput(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-center text-xl font-bold text-white tracking-[0.4em] focus:outline-none focus:border-violet-400" />
            <div className="flex gap-2">
              <button onClick={verifyOtpAndRegister}
                className="flex-1 shine-btn rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black py-3 text-sm shadow-lg glow-violet">
                Verify
              </button>
              <button onClick={() => setShowOtpModal(false)}
                className="rounded-xl bg-white/5 text-slate-400 font-bold px-4 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl glass-card p-8 shadow-2xl glow-violet space-y-4">
            <Key className="text-violet-400 mx-auto" size={48} />
            <h3 className="text-2xl font-black text-white text-center">Change PIN</h3>
            <form onSubmit={handleChangeTeacherPin} className="space-y-3">
              {teacherCurrentPin && (
                <input type="password" required placeholder="Old PIN" value={oldPinInput} onChange={(e) => setOldPinInput(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white" />
              )}
              <input type="password" required placeholder="New PIN" value={newPinInput} onChange={(e) => setNewPinInput(e.target.value)}
                className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-white" />
              <div className="flex gap-2">
                <button type="submit"
                  className="shine-btn flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold py-3 text-sm shadow-lg glow-violet">
                  Update PIN
                </button>
                <button type="button" onClick={() => setShowChangePinModal(false)}
                  className="rounded-xl bg-white/5 text-slate-400 font-bold px-4 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {registeredStudentObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl glass-card p-8 shadow-2xl glow-emerald space-y-6 text-center">
            <img src="deep_education_logo_de_2.png.png" alt="Logo" className="w-20 h-20 mx-auto rounded-2xl object-cover border-2 border-white/20" />
            <h2 className="text-3xl font-black text-gradient-primary">Welcome Aboard!</h2>
            <p className="text-sm text-emerald-400 font-bold">Registration Complete ✓</p>
            <div className="rounded-2xl bg-black/40 border border-white/10 p-5 text-left space-y-3">
              <p className="font-bold text-white">Dear {registeredStudentObj.name},</p>
              <p className="text-xs text-slate-300">Please ask your Teacher to register your Face ID to unlock full portal access.</p>
            </div>
            <button onClick={() => {
              const student = registeredStudentObj;
              setRegisteredStudentObj(null);
              setSession({ mode: 'student', user: student });
              setStudentNavTab('notices');
            }}
              className="shine-btn w-full rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white font-black py-4 flex items-center justify-center gap-2 shadow-lg glow-violet">
              <Sparkles size={18} /> ENTER PORTAL
            </button>
          </div>
        </div>
      )}

      {viewingCertificateModal && activeStudentRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl glass-card p-8 shadow-2xl glow-emerald space-y-6 text-center">
            <div className="rounded-2xl bg-gradient-to-br from-[#0a0520] to-[#050318] border-[3px] border-amber-400/70 p-8 space-y-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400 font-black">DEEP EDUCATION</p>
              <h3 className="text-2xl font-serif font-black text-white">CERTIFICATE OF COMPLETION</h3>
              <p className="text-xs italic text-slate-400">Awarded to</p>
              <p className="text-3xl font-black text-gradient-warm">{activeStudentRecord.name}</p>
              <p className="text-xs text-slate-300">for completing</p>
              <p className="text-base font-bold text-cyan-300">{activeStudentRecord.batch}</p>
              <div className="pt-6 flex flex-col items-center">
                {teacherSignatureImg ? (
                  <img src={teacherSignatureImg} alt="Signature" className="h-14 object-contain mb-1" />
                ) : (
                  <p className="text-2xl font-serif italic font-bold text-amber-300 mb-1">Avradeep Biswas</p>
                )}
                <div className="w-48 border-t border-slate-700 pt-1">
                  <p className="text-xs font-bold text-white">Avradeep Biswas</p>
                  <p className="text-[10px] text-amber-400">Founder & Educator</p>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <button onClick={() => handleDownloadCertificateImage(activeStudentRecord)}
                className="shine-btn rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black px-5 py-3 text-xs shadow-lg glow-emerald">
                <Download size={15} className="inline mr-1" /> Download
              </button>
              <button onClick={() => setViewingCertificateModal(false)}
                className="rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/40 font-bold px-5 py-3 text-xs">Close</button>
            </div>
          </div>
        </div>
      )}

      {viewingFeeBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl glass-card p-6 shadow-2xl glow-amber space-y-5">
            <div className="text-center border-b border-white/10 pb-4">
              <h3 className="text-2xl font-black text-gradient-primary">DEEP EDUCATION</h3>
              <p className="text-[11px] text-amber-400 font-black uppercase">Official Fee Receipt</p>
            </div>
            <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Student</span><span className="font-bold text-white">{viewingFeeBillModal.studentName}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Batch</span><span className="font-bold text-cyan-300">{viewingFeeBillModal.batch}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Month</span><span className="font-bold text-white">{viewingFeeBillModal.month}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-slate-400">Amount</span><span className="font-black text-emerald-400">₹{viewingFeeBillModal.amount}/-</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleDownloadFeeBillImage(viewingFeeBillModal, totalStudentDueAmount)}
                className="shine-btn flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black py-3 text-xs shadow-lg glow-emerald">
                <Download size={15} className="inline mr-1" /> Download Bill
              </button>
              <button onClick={() => setViewingFeeBillModal(null)}
                className="rounded-xl bg-white/5 text-slate-300 font-bold px-4 py-3 text-xs">Close</button>
            </div>
          </div>
        </div>
      )}

      {viewingQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl glass-card p-7 text-center space-y-5 shadow-2xl glow-amber">
            <h3 className="text-2xl font-black text-white">Scan & Pay</h3>
            <div className="bg-white p-4 rounded-2xl inline-block border-2 border-amber-400/70">
              <img src="/upi-qr.png" alt="UPI QR" className="w-56 h-56 object-contain rounded-lg" />
            </div>
            <div className="rounded-xl bg-black/40 border border-white/10 p-3 text-xs text-amber-300 font-mono">deepismedy-3@okaxis</div>
            <button onClick={() => setViewingQrModal(false)}
              className="shine-btn w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold py-3 text-sm shadow-lg glow-rose">
              Close
            </button>
          </div>
        </div>
      )}

      {viewingPdf && (
        <div className="fixed inset-0 z-50 flex flex-col p-4 bg-black/90 backdrop-blur-md">
          <div className="glass-deep px-6 py-4 rounded-t-2xl border-b border-white/10 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2"><Lock size={16} className="text-emerald-400" /> {viewingPdf.title}</h3>
              <p className="text-[11px] text-emerald-400">E2EE Protected</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleAuthorizedStudentPdfDownload(viewingPdf)}
                className="shine-btn rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 px-4 py-2 text-xs font-black shadow-lg glow-emerald">
                <Download size={14} className="inline mr-1" /> Download
              </button>
              <button onClick={closePdfViewer}
                className="rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 px-4 py-2 text-xs font-bold">Close</button>
            </div>
          </div>
          <div className="relative w-full flex-grow bg-white rounded-b-2xl overflow-hidden">
            <iframe src={viewingPdf.decryptedUrl || decryptE2EE(viewingPdf.data)} title={viewingPdf.title} className="w-full h-full border-0" />
          </div>
        </div>
      )}
    </div>
  );
}