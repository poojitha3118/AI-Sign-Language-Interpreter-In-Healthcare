document.addEventListener('DOMContentLoaded', function() {
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const statusIndicator = document.querySelector('.status-indicator');
  const statusText = document.querySelector('.status-text');
  
  // Connection status element
  const connectionStatus = document.createElement('div');
  connectionStatus.className = 'connection-status disconnected';
  connectionStatus.innerHTML = '<i class="fas fa-plug"></i> Connecting...';
  document.body.appendChild(connectionStatus);
  
  // WebSocket connection
  let socket;
  let isTyping = false;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds
  
  // Connect to WebSocket server
  function connect() {
    // In a real app, you would connect to your actual WebSocket server
    // For this example, we'll simulate a connection
    console.log('Connecting to WebSocket server...');
    
    // Simulate connection (in a real app, replace with actual WebSocket)
    setTimeout(() => {
      handleConnect();
    }, 1000);
  }
  
  function handleConnect() {
    console.log('WebSocket connected');
    connectionStatus.className = 'connection-status connected';
    connectionStatus.innerHTML = '<i class="fas fa-plug"></i> Connected';
    
    // Update doctor status
    statusIndicator.className = 'status-indicator online';
    statusText.textContent = 'Online';
    
    // Hide connection status after 3 seconds
    setTimeout(() => {
      connectionStatus.style.opacity = '0';
      setTimeout(() => {
        connectionStatus.style.display = 'none';
      }, 500);
    }, 3000);
    
    // Simulate initial doctor message
    setTimeout(() => {
      addMessage('Hello! How can I help you today?', false);
    }, 1500);
  }
  
  function handleDisconnect() {
    console.log('WebSocket disconnected');
    connectionStatus.className = 'connection-status disconnected';
    connectionStatus.innerHTML = '<i class="fas fa-plug"></i> Disconnected - Reconnecting...';
    connectionStatus.style.display = 'flex';
    connectionStatus.style.opacity = '1';
    
    // Update doctor status
    statusIndicator.className = 'status-indicator offline';
    statusText.textContent = 'Offline';
    
    // Try to reconnect
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      setTimeout(connect, reconnectDelay);
    } else {
      connectionStatus.innerHTML = '<i class="fas fa-plug"></i> Disconnected';
      addMessage('Unable to connect to the doctor. Please try again later.', false);
    }
  }
  
  // Initial connection
  connect();
  
  // Function to add a new message to the chat
  function addMessage(text, isPatient = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isPatient ? 'patient' : 'doctor'}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = text;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = (hours % 12 || 12).toString();
    
    timeDiv.textContent = `${formattedHours}:${minutes}:${seconds} ${ampm}`;
    
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Function to show typing indicator
  function showTypingIndicator() {
    // Remove any existing typing indicator
    const existingTyping = document.querySelector('.typing-indicator');
    if (existingTyping) existingTyping.remove();
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    
    const typingText = document.createElement('div');
    typingText.textContent = 'Doctor is typing';
    
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'typing-dots';
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'typing-dot';
      dotsDiv.appendChild(dot);
    }
    
    typingDiv.appendChild(typingText);
    typingDiv.appendChild(dotsDiv);
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return typingDiv;
  }
  
  // Function to simulate doctor response
  function simulateDoctorResponse(patientMessage) {
    const typingIndicator = showTypingIndicator();
    
    // Random delay between 1-3 seconds to simulate typing
    const typingTime = 1000 + Math.random() * 2000;
    
    setTimeout(() => {
      typingIndicator.remove();
      
      let response;
      
      // Simple response logic based on patient message
      if (patientMessage.toLowerCase().includes('chest pain')) {
        if (patientMessage.toLowerCase().includes('since')) {
          response = "How severe is the pain on a scale of 1 to 10?";
        } else {
          response = "Are you experiencing any other symptoms with the chest pain?";
        }
      } else if (patientMessage.toLowerCase().includes('symptom')) {
        response = "I understand. Can you describe your symptoms in more detail?";
      } else if (patientMessage.toLowerCase().includes('thank')) {
        response = "You're welcome! Is there anything else I can help you with?";
      } else if (patientMessage.toLowerCase().includes('hi') || 
                 patientMessage.toLowerCase().includes('hello')) {
        response = "Hello! How can I help you today?";
      } else {
        const randomResponses = [
          "I see. Can you tell me more about that?",
          "How long have you been experiencing this?",
          "Have you taken any medication for this?",
          "Are you currently under any treatment?",
          "I understand. Let me check your medical history."
        ];
        response = randomResponses[Math.floor(Math.random() * randomResponses.length)];
      }
      
      addMessage(response, false);
      
      // Random follow-up question 30% of the time
      if (Math.random() < 0.3) {
        setTimeout(() => {
          const followUpQuestions = [
            "Is there anything else you'd like to share?",
            "How are you feeling now?",
            "Have you noticed any other changes?",
            "When did you first notice these symptoms?"
          ];
          const followUp = followUpQuestions[Math.floor(Math.random() * followUpQuestions.length)];
          addMessage(followUp, false);
        }, 1500 + Math.random() * 2000);
      }
    }, typingTime);
  }
  
  // Send message when button is clicked
  sendButton.addEventListener('click', sendMessage);
  
  // Send message when Enter is pressed (but allow Shift+Enter for new lines)
  messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
      // In a real app, you would send this message via WebSocket
      // For this example, we'll just simulate sending
      addMessage(message);
      messageInput.value = '';
      
      // Simulate doctor response
      setTimeout(() => {
        simulateDoctorResponse(message);
      }, 500 + Math.random() * 1000);
    }
  }
  
  // Auto-resize textarea as user types
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
  
  // Simulate connection issues randomly
  setInterval(() => {
    if (Math.random() < 0.01) { // 1% chance of connection issue
      handleDisconnect();
      setTimeout(connect, 3000);
    }
  }, 10000);
  
  // Initial welcome message
  setTimeout(() => {
    addMessage("Welcome to your healthcare chat. Please describe your symptoms or concerns.", false);
  }, 500);
});