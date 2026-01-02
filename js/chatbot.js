// Chatbot Logic
const chatbotConfig = {
  botName: "Sara",
  welcomeMessage: "Hello! I'm Sara. How can I help you today?",
  simulatedDelay: 600, // ms
};

// SVG Icons (using strings to avoid external dependencies for icons if possible, or we can use Material Symbols if linked)
// Let's assume we'll use Material Symbols Outlined from Google Fonts as they are likely already used or easy to add.
// If not, I'll inject the link.

const initChatbot = () => {
  // 1. Inject HTML Structure
  const body = document.body;

  // Inject Font for Icons if not present (Material Symbols Rounded for modern look)
  if (!document.querySelector('link[href*="material-symbols"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@48,400,0,0";
    document.head.appendChild(link);
  }

  // Create Chatbot Elements
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
        <button class="chatbot-toggler">
            <span class="material-symbols-rounded">chat_bubble</span>
            <span class="material-symbols-rounded">close</span>
        </button>
        <div class="chatbot">
            <header>
                <h2>${chatbotConfig.botName}</h2>
                <p>Powered by Generative AI</p>
                <span class="close-btn material-symbols-rounded">close</span>
            </header>
            <ul class="chatbox">
                <li class="chat incoming">
                    <span class="material-symbols-rounded">smart_toy</span>
                    <p>${chatbotConfig.welcomeMessage}</p>
                </li>
            </ul>
            <div class="chat-input">
                <textarea placeholder="Type a message..." spellcheck="false" required></textarea>
                <span id="send-btn" class="material-symbols-rounded">send</span>
            </div>
        </div>
    `;

  document.body.appendChild(wrapper);

  // 2. Select Elements
  const chatbotToggler = document.querySelector(".chatbot-toggler");
  const closeBtn = document.querySelector(".close-btn");
  const chatbox = document.querySelector(".chatbox");
  const chatInput = document.querySelector(".chat-input textarea");
  const sendChatBtn = document.querySelector(".chat-input span");

  let userMessage = null;
  const inputInitHeight = chatInput.scrollHeight;

  // 3. Helper Functions
  const createChatLi = (message, className) => {
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", className);
    let chatContent =
      className === "outgoing"
        ? `<p></p>`
        : `<span class="material-symbols-rounded">smart_toy</span><p></p>`;
    chatLi.innerHTML = chatContent;
    chatLi.querySelector("p").textContent = message;
    return chatLi;
  };

  const generateResponse = (incomingChatLi) => {
    const messageElement = incomingChatLi.querySelector("p");

    // SIMULATED AI AGENT LOGIC
    // In a real app, this would be a fetch() call to an API.
    const keywords = userMessage.toLowerCase();
    let response = "I'm not sure I understand. Could you verify that?";

    if (keywords.includes("hello") || keywords.includes("hi")) {
      response = "Hi there! Ready to build something amazing?";
    } else if (keywords.includes("price") || keywords.includes("cost")) {
      response =
        "Our pricing is tailored to your project's needs. Would you like to request a quote?";
    } else if (keywords.includes("service") || keywords.includes("offer")) {
      response =
        "We offer web design, development, and digital strategy services.";
    } else if (keywords.includes("contact") || keywords.includes("email")) {
      response =
        "You can reach us at contact@idesignmoz.com or through our contact page.";
    } else if (keywords.includes("add") || keywords.includes("create")) {
      response =
        "I can definitely help with that! " +
        keywords +
        " sounds like a great idea.";
    } else {
      // Generative-ish fallback
      const fallbacks = [
        "That's an interesting perspective. Tell me more.",
        "I can help you with web development and design inquiries.",
        "Let's focus on your project goals. What are you looking to achieve?",
        "I'm currently running in simulation mode, but I'm here to help!",
      ];
      response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // Simulate "typing" delay
    setTimeout(() => {
      messageElement.textContent = response;
      chatbox.scrollTo(0, chatbox.scrollHeight);
    }, 600);
  };

  const handleChat = () => {
    userMessage = chatInput.value.trim();
    if (!userMessage) return;

    // Clear input
    chatInput.value = "";
    chatInput.style.height = `${inputInitHeight}px`;

    // Append User Message
    const outgoingChatLi = createChatLi(userMessage, "outgoing");
    chatbox.appendChild(outgoingChatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);

    // Show "Thinking..."
    setTimeout(() => {
      const incomingChatLi = createChatLi("Thinking...", "incoming");
      chatbox.appendChild(incomingChatLi);
      chatbox.scrollTo(0, chatbox.scrollHeight);
      generateResponse(incomingChatLi);
    }, 600);
  };

  // 4. Event Listeners
  chatInput.addEventListener("input", () => {
    chatInput.style.height = `${inputInitHeight}px`;
    chatInput.style.height = `${chatInput.scrollHeight}px`;
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
      e.preventDefault();
      handleChat();
    }
  });

  sendChatBtn.addEventListener("click", handleChat);
  closeBtn.addEventListener("click", () =>
    document.body.classList.remove("show-chatbot")
  );
  chatbotToggler.addEventListener("click", () =>
    document.body.classList.toggle("show-chatbot")
  );
};

// Initialize after DOM load
document.addEventListener("DOMContentLoaded", initChatbot);
