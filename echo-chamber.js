(function() {
  // --- STATE MANAGEMENT ---
  const state = {
    paths: {},
    echoes: [],
    user: {
      currentPath: null,
      currentStep: 0,
      reflections: {}
    },
    isOpen: false
  };

  // --- DOM ELEMENTS ---
  let echoWindow, echoToggleButton, echoMessages, echoInputArea, echoHeader;

  // --- CORE FUNCTIONS ---
  function toggleEchoWindow() {
    state.isOpen = !state.isOpen;
    if (echoWindow) {
      echoWindow.classList.toggle('active', state.isOpen);
    }
  }

  function addMessage(text, type = 'guide-message', choices = []) {
    if (!echoMessages) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = `echo-message ${type}`;
    messageDiv.innerHTML = text; // Use innerHTML to render links and bold text

    if (choices.length > 0) {
      const choicesDiv = document.createElement('div');
      choicesDiv.className = 'echo-choices';
      choices.forEach(choice => {
        const button = document.createElement('button');
        button.textContent = choice.text;
        button.onclick = () => {
          choicesDiv.querySelectorAll('button').forEach(btn => btn.disabled = true);
          choice.action();
        };
        choicesDiv.appendChild(button);
      });
      messageDiv.appendChild(choicesDiv);
    }
    
    echoMessages.appendChild(messageDiv);
    echoMessages.scrollTop = echoMessages.scrollHeight;
  }

  function showReflectionInput(pathKey, step) {
    if (!echoInputArea) return;
    echoInputArea.innerHTML = `
      <textarea id="reflection-textarea" placeholder="Write your reflection here..."></textarea>
      <button id="save-reflection-btn">Save Reflection</button>
    `;
    echoInputArea.style.display = 'block';
    echoMessages.scrollTop = echoMessages.scrollHeight;

    document.getElementById('save-reflection-btn').onclick = () => saveReflection(pathKey, step);
  }

  async function saveReflection(pathKey, step) {
    const textarea = document.getElementById('reflection-textarea');
    if (!textarea) return;

    const reflectionText = textarea.value.trim();
    if (reflectionText) {
      state.user.reflections[`${pathKey}_${step.day}`] = reflectionText;
      await localforage.setItem('echoUser', state.user);
      
      echoInputArea.innerHTML = '';
      echoInputArea.style.display = 'none';

      addMessage(reflectionText, 'user-reflection');
      
      const nextStep = state.paths[pathKey].steps.find(s => s.day === step.day + 1);
      if (nextStep) {
        state.user.currentStep = step.day + 1;
        await localforage.setItem('echoUser', state.user);
        setTimeout(() => {
          addMessage(`Thank you for sharing. Your reflection is saved.<br><br>When you are ready for the next step of your journey, I will be here.`);
        }, 500);
      } else {
        state.user.currentPath = null;
        state.user.currentStep = 0;
        await localforage.setItem('echoUser', state.user);
        setTimeout(() => {
          addMessage(`You have completed the <strong>${state.paths[pathKey].title}</strong>. A significant accomplishment.`);
          addMessage(`You can now download your personal journal.`, 'guide-message', [
            { text: 'Download My Journal PDF', action: () => generatePDF(pathKey) },
            { text: 'Start a New Path', action: startJourneyDecision }
          ]);
        }, 500);
      }
    }
  }

  function presentStep(pathKey, step) {
    const postTitle = step.file.split('/').pop().replace('.md', '').replace(/-/g, ' ');
    addMessage(`<strong>Step ${step.day} of your journey:</strong><br>Please take some time to read the following article: <a href="post.html?file=${encodeURIComponent(step.file)}" target="_blank" rel="noopener noreferrer">${postTitle}</a>`);
    
    addMessage(`When you have finished reading, let me know.`, 'guide-message', [{
      text: "I've Finished Reading",
      action: () => {
        addMessage(step.prompt);
        showReflectionInput(pathKey, step);
      }
    }]);
  }

  function startJourneyDecision() {
    echoMessages.innerHTML = '';
    addMessage("What are you seeking today?", 'guide-message', Object.keys(state.paths).map(key => ({
      text: state.paths[key].title,
      action: () => startPath(key)
    })));
  }

  async function startPath(pathKey) {
    state.user.currentPath = pathKey;
    state.user.currentStep = 1;
    state.user.reflections = state.user.reflections || {};
    await localforage.setItem('echoUser', state.user);
    
    echoMessages.innerHTML = '';
    addMessage(`You have begun the <strong>${state.paths[pathKey].title}</strong>. A wise choice.`);
    
    const randomEcho = state.echoes.find(e => e.path === pathKey);
    if (randomEcho) {
      setTimeout(() => addMessage(randomEcho.reflection, 'community-echo'), 1200);
    }

    setTimeout(() => {
      const firstStep = state.paths[pathKey].steps[0];
      presentStep(pathKey, firstStep);
    }, randomEcho ? 3000 : 1500);
  }

  async function resumeJourney() {
    const { currentPath, currentStep } = state.user;
    const pathData = state.paths[currentPath];

    if (!pathData) {
      state.user.currentPath = null;
      state.user.currentStep = 0;
      await localforage.setItem('echoUser', state.user);
      startJourneyDecision();
      return;
    }
    
    addMessage(`Welcome back. You are on <strong>Step ${currentStep}</strong> of the <strong>${pathData.title}</strong>.`);
    
    const stepData = pathData.steps.find(s => s.day === currentStep);
    if (stepData) {
      presentStep(currentPath, stepData);
    } else {
      addMessage("It seems you've already completed this path. Congratulations!");
      addMessage(`Would you like to download your journal or start a new path?`, 'guide-message', [
          { text: 'Download Journal PDF', action: () => generatePDF(currentPath) },
          { text: 'Start a New Path', action: startJourneyDecision }
      ]);
    }
  }

  async function generatePDF(pathKey) {
    if (typeof jspdf === 'undefined') {
        addMessage("Sorry, the PDF generator is currently unavailable. Please try again later.");
        return;
    }
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const path = state.paths[pathKey];

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(path.title, 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("A Personal Journal of Reflection", 105, 30, { align: 'center' });
    doc.text(`Completed on: ${new Date().toLocaleDateString()}`, 105, 38, { align: 'center' });
    
    let y = 60;
    path.steps.forEach(step => {
      if (y > 250) { 
        doc.addPage();
        y = 20;
      }
      const postTitle = step.file.split('/').pop().replace('.md', '').replace(/-/g, ' ');

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Step ${step.day}: On "${postTitle}"`, 14, y);
      y += 10;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100);
      doc.text(step.prompt, 14, y, { maxWidth: 180 });
      y += 15;
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      const reflection = state.user.reflections[`${pathKey}_${step.day}`] || "No reflection written for this step.";
      const lines = doc.splitTextToSize(reflection, 180);
      doc.text(lines, 14, y);
      y += (lines.length * 7) + 20;
    });

    doc.save(`${path.title.replace(/\s+/g, '_')}_Journal.pdf`);
    addMessage("Your PDF journal has been created and downloaded.");
  }

  async function initEchoChamber() {
    echoWindow = document.getElementById('echo-window');
    echoToggleButton = document.getElementById('echo-toggle-button');
    echoMessages = document.getElementById('echo-messages');
    echoInputArea = document.getElementById('echo-input-area');
    echoHeader = document.getElementById('echo-header');

    if (!echoWindow || !echoToggleButton || !echoMessages || !echoInputArea) {
      console.error("Echo Chamber DOM elements not found. Aborting initialization.");
      return;
    }

    try {
      const [pathsRes, echoesRes, userData] = await Promise.all([
        fetch('/paths.json'),
        fetch('/echoes.json'),
        localforage.getItem('echoUser')
      ]);
      
      if (!pathsRes.ok || !echoesRes.ok) {
        throw new Error("Failed to load path or echo data.");
      }
      
      state.paths = await pathsRes.json();
      state.echoes = await echoesRes.json();
      
      if (userData) {
        state.user = { ...state.user, ...userData };
      }

      if (state.user.currentPath && state.user.currentStep > 0) {
        resumeJourney();
      } else {
        startJourneyDecision();
      }

      echoToggleButton.addEventListener('click', toggleEchoWindow);

    } catch (error) {
      console.error("Could not initialize The Echo Chamber:", error);
      const widget = document.querySelector('.echo-chamber-widget');
      if(widget) widget.style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', initEchoChamber);

})();
