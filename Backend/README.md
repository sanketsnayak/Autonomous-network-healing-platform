# Autonomous Network Healing Platform - Backend

A comprehensive backend system for autonomous network monitoring, incident detection, root cause analysis, and automated remediation.

## 🌟 Features

### Core Capabilities
- **Telemetry Collection**: Multi-protocol data collection (SNMP, Syslog, NETCONF)
- **Alert Correlation**: Intelligent grouping of related alerts into incidents
- **Root Cause Analysis**: Automated RCA using deterministic rules and topology analysis
- **Automated Remediation**: Policy-driven automated actions with safety checks and rollback
- **Incident Management**: Complete incident lifecycle management
- **Network Topology**: Dynamic topology discovery and impact analysis

### API Endpoints
- **Devices** (`/api/devices`) - Network device management and monitoring
- **Alerts** (`/api/alerts`) - Alert ingestion and management  
- **Incidents** (`/api/incidents`) - Incident lifecycle and tracking
- **Policies** (`/api/policies`) - Automation policy management
- **Topology** (`/api/topology`) - Network topology and dependencies
- **Actions** (`/api/actions`) - Remediation action management
- **Health** (`/api/health`) - System health and service status
- **Metrics** (`/api/metrics`) - Platform performance metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm 8+
- MongoDB 5.0+
- Environment variables configured (see `.env.example`)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd Backend
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and other settings
   ```

3. **Set up development environment**
   ```bash
   npm run setup
   ```
   This creates sample devices, topology, policies, and test data.

4. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

The server will start on `http://localhost:5000` with all services initialized.

## 📁 Project Structure

```
Backend/
├── src/
│   ├── models/              # Database models
│   │   ├── Device.js        # Network device model
│   │   ├── Alert.js         # Alert/alarm model
│   │   ├── Incident.js      # Incident tracking model
│   │   ├── Action.js        # Remediation action model
│   │   ├── Policy.js        # Automation policy model
│   │   └── Topology.js      # Network topology model
│   ├── services/            # Core autonomous healing services
│   │   ├── TelemetryCollector.js       # Data collection service
│   │   ├── AlertCorrelationService.js  # Alert correlation engine
│   │   ├── RootCauseAnalysisEngine.js  # RCA processing engine
│   │   ├── RemediationEngine.js        # Action execution engine
│   │   └── AutonomousHealingService.js # Main orchestration service
│   ├── routes/              # API route handlers
│   │   ├── devices.js       # Device management API
│   │   ├── alerts.js        # Alert management API
│   │   ├── incidents.js     # Incident management API
│   │   ├── policies.js      # Policy management API
│   │   ├── topology.js      # Topology management API
│   │   └── actions.js       # Action management API
│   ├── config/              # Configuration files
│   │   └── db.js           # Database connection setup
│   ├── app.js              # Express application setup
│   └── server.js           # Server entry point
├── setup-dev-environment.js # Development data setup script
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## 🔧 Service Architecture

### Core Services

1. **TelemetryCollector**
   - Collects metrics via SNMP, Syslog, SSH
   - Normalizes data from different sources
   - Real-time data processing and alerting

2. **AlertCorrelationService** 
   - Groups related alerts into incidents
   - Topology-aware correlation
   - Reduces alert noise and false positives

3. **RootCauseAnalysisEngine**
   - Automated root cause analysis
   - Uses deterministic rules and topology data
   - Temporal analysis for complex scenarios

4. **RemediationEngine**
   - Executes automated remediation actions
   - Safety checks and approval workflows
   - Rollback capabilities for failed actions

5. **AutonomousHealingService**
   - Orchestrates all healing services
   - Event-driven architecture
   - Provides health monitoring and metrics

## 📊 API Documentation

### Device Management
```bash
# Get all devices
GET /api/devices

# Get device details
GET /api/devices/:id

# Update device
PUT /api/devices/:id

# Get device health metrics
GET /api/devices/:id/health
```

### Incident Management
```bash
# List incidents
GET /api/incidents

# Get incident details
GET /api/incidents/:id

# Acknowledge incident
POST /api/incidents/:id/acknowledge

# Escalate incident
POST /api/incidents/:id/escalate

# Get incident timeline
GET /api/incidents/:id/timeline
```

### Policy Management
```bash
# List policies
GET /api/policies

# Create new policy
POST /api/policies

# Activate policy
POST /api/policies/:id/activate

# Get policy execution history
GET /api/policies/:id/history
```

### Action Management
```bash
# List actions
GET /api/actions

# Execute action
POST /api/actions/:id/execute

# Rollback action
POST /api/actions/:id/rollback

# Get action templates
GET /api/actions/templates
```

## 🔍 Monitoring and Health

### Health Endpoints
```bash
# Overall system health
GET /api/health

# Service metrics
GET /api/metrics

# Service configuration
GET /api/config
```

### Health Check Scripts
```bash
# Quick health check
npm run health

# View metrics
npm run metrics

# View logs (if configured)
npm run logs
```

## 🛠 Development

### Available Scripts

```bash
npm run dev         # Start development server with auto-reload
npm run start       # Start production server
npm run setup       # Initialize development environment with sample data
npm run reset-db    # Reset database and recreate sample data
npm run health      # Check server health status
npm run metrics     # View server metrics
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
MONGO_URI=mongodb://localhost:27017/autonomous-network-healing

# Server
PORT=5000
NODE_ENV=development

# Security
JWT_SECRET=your-jwt-secret-key

# External Services
SNMP_COMMUNITY=public
SNMP_VERSION=2c

# Notification Settings
EMAIL_SERVICE=gmail
EMAIL_USER=alerts@company.com
EMAIL_PASS=app-password

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### Database Models

All models include comprehensive validation, indexing, and business logic:

- **Device**: Network equipment with health monitoring
- **Alert**: Individual alarms with correlation metadata
- **Incident**: Grouped alerts with RCA and resolution tracking
- **Policy**: Automation rules with condition/action logic
- **Topology**: Network relationships and dependencies
- **Action**: Remediation tasks with execution tracking

## 🔐 Security Considerations

- **Input Validation**: All API inputs are validated and sanitized
- **Authentication**: JWT-based authentication (implement as needed)
- **Authorization**: Role-based access control for sensitive operations
- **Audit Logging**: All actions are logged for compliance
- **Secure Credentials**: Device credentials encrypted at rest
- **Network Security**: SNMP v3, SSH key authentication

## 📈 Performance & Scalability

- **Event-driven Architecture**: Asynchronous processing for scalability
- **Database Indexing**: Optimized queries for large datasets
- **Caching**: In-memory caching for frequently accessed data
- **Connection Pooling**: Efficient database connection management
- **Background Processing**: Non-blocking operations for real-time responsiveness

## 🚨 Error Handling

The platform includes comprehensive error handling:

- **Graceful Degradation**: Services continue operating during partial failures
- **Retry Logic**: Automatic retry for transient failures
- **Circuit Breakers**: Prevent cascade failures
- **Error Correlation**: Link related errors for better troubleshooting
- **Health Monitoring**: Automatic service health detection

## 📝 Logging

Structured logging is implemented throughout:

- **Request/Response Logging**: All API calls logged
- **Service Events**: Key service events and state changes
- **Error Logging**: Detailed error information with context
- **Performance Metrics**: Execution times and resource usage
- **Audit Trail**: Complete audit trail for compliance

## 🔄 Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   npm install --production
   ```

2. **Database Migration**
   ```bash
   npm run setup  # Creates initial data
   ```

3. **Service Start**
   ```bash
   npm start
   ```

4. **Health Verification**
   ```bash
   curl http://localhost:5000/api/health
   ```

### Docker Deployment (Optional)

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src/ ./src/
COPY setup-dev-environment.js ./
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Follow the existing code structure and commenting style
2. Add comprehensive comments for all functions
3. Include input validation and error handling
4. Write tests for new functionality
5. Update this README for significant changes

## 📚 Additional Resources

- **MongoDB Documentation**: https://docs.mongodb.com/
- **Express.js Guide**: https://expressjs.com/
- **SNMP Protocol Reference**: https://tools.ietf.org/html/rfc1157
- **NETCONF Protocol**: https://tools.ietf.org/html/rfc6241

## 🆘 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Verify MONGO_URI in .env
   - Ensure MongoDB service is running
   - Check network connectivity

2. **SNMP Collection Errors**
   - Verify SNMP community strings
   - Check device SNMP configuration
   - Confirm network accessibility

3. **High Memory Usage**
   - Review telemetry collection frequency
   - Check for memory leaks in custom code
   - Monitor database query performance

4. **Service Startup Failures**
   - Check environment variables
   - Verify all dependencies are installed
   - Review application logs for errors

### Getting Help

- Check the `/api/health` endpoint for service status
- Review application logs for error details
- Verify environment configuration
- Test database connectivity separately

---

**Version**: 1.0.0  
**Last Updated**: October 2025  
**Maintainer**: Network Operations Team
