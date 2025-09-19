const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));


// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/medical-documents';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, and Word documents are allowed.'));
    }
  }
});

// MongoDB connection
const MONGODB_URI = 'mongodb://localhost:27017/healthcare_asl';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['patient', 'doctor', 'nurse', 'interpreter'],
    default: 'patient'
  },
  phone: {
    type: String,
    trim: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  professional: {
    licenseNumber: String,
    specialization: String,
    hospital: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Medical Document Schema
const medicalDocumentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    trim: true
  }
});

// Doctor Request Schema
const doctorRequestSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  requestType: {
    type: String,
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  description: {
    type: String,
    trim: true
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  assignedDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  sessionNotes: {
    type: String,
    trim: true
  }
});

// Communication Session Schema
const sessionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  interpreterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DoctorRequest',
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'cancelled'],
    default: 'waiting'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number // in minutes
  },
  notes: {
    type: String,
    trim: true
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
const MedicalDocument = mongoose.model('MedicalDocument', medicalDocumentSchema);
const DoctorRequest = mongoose.model('DoctorRequest', doctorRequestSchema);
const Session = mongoose.model('Session', sessionSchema);

// Auto-assign doctor function
async function autoAssignDoctor(requestId) {
  try {
    // Find available online doctors
    const availableDoctors = await User.find({
      role: 'doctor',
      isOnline: true
    });

    if (availableDoctors.length === 0) {
      // No online doctors, find any available doctor
      const allDoctors = await User.find({ role: 'doctor' });
      if (allDoctors.length === 0) {
        throw new Error('No doctors available');
      }
      
      // Assign to random available doctor
      const randomDoctor = allDoctors[Math.floor(Math.random() * allDoctors.length)];
      await DoctorRequest.findByIdAndUpdate(requestId, {
        doctorId: randomDoctor._id,
        status: 'assigned',
        assignedDate: new Date()
      });
      
      return randomDoctor;
    }

    // Assign to random online doctor
    const randomDoctor = availableDoctors[Math.floor(Math.random() * availableDoctors.length)];
    await DoctorRequest.findByIdAndUpdate(requestId, {
      doctorId: randomDoctor._id,
      status: 'assigned',
      assignedDate: new Date()
    });

    return randomDoctor;
  } catch (error) {
    console.error('Error auto-assigning doctor:', error);
    throw error;
  }
}

// Routes

// Register endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { fullName, email, password, role, phone, emergencyContact, professional } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    const userData = {
      fullName,
      email,
      password,
      role,
      phone
    };

    if (role === 'patient' && emergencyContact) {
      userData.emergencyContact = emergencyContact;
    } else if ((role === 'doctor' || role === 'nurse') && professional) {
      userData.professional = professional;
    }

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed. Please try again.' 
    });
  }
});

// Check email endpoint
app.post('/api/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already exists' 
      });
    }
    
    res.json({ success: true, message: 'Email available' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Login endpoint
app.post('/api/login', async (req, res) => {
  console.log("Login request body:", req.body);  // Debug line - check what's coming from frontend

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    

    // Update user online status
    await User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastSeen: new Date()
    });

    // Respond with success and user data
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Dashboard data endpoints
app.get('/api/dashboard/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let dashboardData = {};

    if (user.role === 'patient') {
      const onlineDoctors = await User.countDocuments({ role: 'doctor', isOnline: true });
      const myRequests = await DoctorRequest.countDocuments({ patientId: userId, status: { $in: ['pending', 'assigned'] } });
      const activeSessions = await Session.countDocuments({ patientId: userId, status: 'active' });

      dashboardData = {
        onlineDoctors,
        myRequests,
        activeSessions,
        connectionStatus: 'Ready',
        emergencyStatus: 'Normal'
      };
    } else if (user.role === 'doctor') {
      const pendingRequests = await DoctorRequest.countDocuments({ 
        $or: [
          { status: 'pending' },
          { doctorId: userId, status: 'assigned' }
        ]
      });
      const emergencyAlerts = await DoctorRequest.countDocuments({ 
        requestType: 'emergency', 
        status: { $in: ['pending', 'assigned'] }
      });
      const activeSessions = await Session.countDocuments({ doctorId: userId, status: 'active' });
      const patientsHelpedToday = await Session.countDocuments({ 
        doctorId: userId, 
        status: 'completed',
        startTime: { $gte: new Date().setHours(0, 0, 0, 0) }
      });

      dashboardData = {
        pendingRequests,
        emergencyAlerts,
        activeSessions,
        patientsHelpedToday,
        professional: user.professional
      };
    }

    res.json({
      success: true,
      data: dashboardData,
      user: {
        id: user._id,
        name: user.fullName,
        role: user.role,
        professional: user.professional
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

// Request doctor endpoint
app.post('/api/request-doctor', async (req, res) => {
  try {
    const { patientId, requestType = 'normal', description } = req.body;

    const request = new DoctorRequest({
      patientId,
      requestType,
      description,
      status: 'pending'
    });

    await request.save();

    // Auto-assign doctor
    try {
      const assignedDoctor = await autoAssignDoctor(request._id);
      
      // Create session
      const session = new Session({
        patientId,
        doctorId: assignedDoctor._id,
        requestId: request._id,
        status: 'waiting'
      });
      
      await session.save();

      res.json({
        success: true,
        message: 'Doctor request submitted and assigned successfully',
        request: {
          id: request._id,
          status: 'assigned',
          assignedDoctor: {
            id: assignedDoctor._id,
            name: assignedDoctor.fullName,
            specialization: assignedDoctor.professional?.specialization
          }
        }
      });
    } catch (assignError) {
      res.json({
        success: true,
        message: 'Doctor request submitted and queued',
        request: {
          id: request._id,
          status: 'pending'
        }
      });
    }

  } catch (error) {
    console.error('Request doctor error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit request' });
  }
});

// Get doctor requests (for doctor dashboard)
app.get('/api/doctor-requests/:doctorId', async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    
    const requests = await DoctorRequest.find({
      $or: [
        { status: 'pending' },
        { doctorId: doctorId, status: { $in: ['assigned', 'active'] } }
      ]
    }).populate('patientId', 'fullName email phone emergencyContact').sort({ requestDate: -1 });

    res.json({
      success: true,
      requests
    });

  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

// Upload medical document
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    const { patientId, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const document = new MedicalDocument({
      patientId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      description
    });

    await document.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: document._id,
        fileName: document.originalName,
        uploadDate: document.uploadDate
      }
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
});

// Get medical documents
app.get('/api/documents/:patientId', async (req, res) => {
  try {
    const patientId = req.params.patientId;
    const documents = await MedicalDocument.find({ patientId }).sort({ uploadDate: -1 });

    res.json({
      success: true,
      documents
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
});

// Logout endpoint
app.post('/api/logout', async (req, res) => {
  try {
    const { userId } = req.body;
    
    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

// Serve static files
app.use('/uploads', express.static('uploads'));

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/patient-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient-dashboard.html'));
});

app.get('/doctor-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor-dashboard.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open your browser and visit: http://localhost:${PORT}`);
});

module.exports = app;