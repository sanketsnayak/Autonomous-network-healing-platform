# Autonomous Network Healing Platform

A comprehensive network management and autonomous healing platform that provides real-time monitoring, intelligent root cause analysis, and automated remediation for network infrastructure.

## 🚀 Features

### Core Capabilities
- **Real-time Network Monitoring** - Continuous telemetry collection via SNMP, Syslog, and APIs
- **Intelligent Alert Correlation** - Smart correlation of related alerts to reduce noise
- **Autonomous Root Cause Analysis** - AI-powered RCA with confidence scoring
- **Automated Remediation** - Policy-driven self-healing with approval workflows
- **Network Topology Discovery** - Automatic discovery and visualization of network topology
- **Service Impact Analysis** - Business service dependency mapping and impact assessment

### Advanced Features
- **Policy-Based Automation** - Configurable healing policies with conditional logic
- **Multi-Site Management** - Centralized management across multiple network sites
- **Performance Analytics** - Historical trending and performance analysis
- **Incident Management** - Full incident lifecycle management with timeline tracking
- **Integration Ready** - APIs for ITSM, monitoring, and external systems

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │    Database     │
│   (React +      │◄──►│   (Node.js +    │◄──►│   (MongoDB)     │
│   Tailwind)     │    │   Express)      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌────────┴────────┐
                       │                 │
              ┌─────────────────┐ ┌─────────────────┐
              │   Autonomous    │ │   External      │
              │   Healing       │ │   Integrations  │
              │   Services      │ │   (SNMP, APIs)  │
              └─────────────────┘ └─────────────────┘
```

### Backend Services
- **Telemetry Collector** - Collects data from network devices
- **Alert Correlation Engine** - Correlates and deduplicates alerts
- **Root Cause Analysis Engine** - Analyzes incidents and identifies root causes
- **Remediation Engine** - Executes automated healing actions
- **Policy Engine** - Manages automation policies and workflows

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **MongoDB** 4.4+ (local or Atlas)
- **Network Access** to monitored devices (SNMP, SSH)
- **Administrative Privileges** for SNMP trap listening (optional)

## 🚀 Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd Backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB connection string and settings

# Set up development environment with sample data
npm run setup

# Start the backend server
npm run dev
```

The backend will start on `http://localhost:5000`

### 2. Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd FrontEnd

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:5173`

## 🔧 Configuration

### Backend Environment Variables

Key configuration options in `Backend/.env`:

```bash
# Database
MONGO_URI=mongodb://localhost:27017/autonomous-network-healing

# Server
PORT=5000
NODE_ENV=development

# Network Device Access
SNMP_COMMUNITY=public
DEFAULT_SSH_USERNAME=admin

# Autonomous Healing
AUTO_REMEDIATION_ENABLED=true
REQUIRE_APPROVAL_CRITICAL=true
MAX_AUTO_REMEDIATION_ATTEMPTS=3

# Notifications
EMAIL_USER=alerts@yourcompany.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Frontend Environment Variables

Configuration options in `FrontEnd/.env`:

```bash
# API Connection
VITE_API_URL=http://localhost:5000/api

# Features
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_REALTIME_UPDATES=true

# UI Settings
VITE_CHART_REFRESH_INTERVAL=30000
VITE_DASHBOARD_REFRESH_INTERVAL=15000
```

## 📊 Sample Data

The setup script creates comprehensive sample data:

- **4 Network Devices** (Router, Switch, Firewall, WiFi AP)
- **Network Topology** with sites, services, and links
- **Automation Policies** for common healing scenarios
- **Sample Alerts** and incidents for demonstration

## 🌐 API Endpoints

### Device Management
- `GET /api/devices` - List all devices
- `POST /api/devices` - Add new device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Remove device

### Alert Management
- `GET /api/alerts` - List alerts
- `POST /api/alerts` - Create alert
- `PUT /api/alerts/:id` - Update alert status

### Incident Management
- `GET /api/incidents` - List incidents
- `POST /api/incidents` - Create incident
- `PUT /api/incidents/:id` - Update incident

### Topology
- `GET /api/topology` - Get network topology
- `POST /api/topology` - Create/update topology

### Policies
- `GET /api/policies` - List automation policies
- `POST /api/policies` - Create policy
- `PUT /api/policies/:id` - Update policy

### Actions
- `GET /api/actions` - List remediation actions
- `POST /api/actions` - Execute action

### Health & Metrics
- `GET /api/health` - Service health check
- `GET /api/metrics` - Platform metrics

## 🎛️ User Interface

### Dashboard
- Real-time system overview
- Key performance indicators
- Recent alerts and incidents
- Service health status
- Network topology visualization

### Device Management
- Device inventory with status
- Performance metrics and trends
- Configuration management
- Device health monitoring

### Alert Center
- Real-time alert stream
- Alert correlation and grouping
- Severity-based filtering
- Alert acknowledgment and resolution

### Incident Management
- Incident timeline and status
- Root cause analysis results
- Remediation action tracking
- Incident reports and analytics

### Topology View
- Interactive network topology
- Service dependency mapping
- Site and device grouping
- Visual health indicators

### Policy Management
- Automation policy editor
- Policy testing and validation
- Execution history and logs
- Template library

## 🔄 Autonomous Healing Workflow

1. **Monitoring** - Continuous telemetry collection from network devices
2. **Detection** - Real-time analysis and alert generation
3. **Correlation** - Smart grouping of related alerts into incidents
4. **Analysis** - Root cause analysis with confidence scoring
5. **Decision** - Policy-based determination of remediation actions
6. **Execution** - Automated or approved remediation execution
7. **Validation** - Verification of successful healing
8. **Learning** - Feedback loop for improving future decisions

## 🔌 Integrations

### Network Monitoring
- **SNMP** - Device monitoring and trap collection
- **Syslog** - Log message collection and analysis
- **REST APIs** - Integration with existing monitoring tools

### ITSM Systems
- **ServiceNow** - Ticket creation and updates
- **Jira** - Issue tracking integration
- **Custom APIs** - Webhook-based integrations

### Notifications
- **Email** - SMTP-based email notifications
- **Slack** - Real-time team notifications
- **Microsoft Teams** - Collaboration platform integration

## 🚦 Production Deployment

### Prerequisites
- Production MongoDB cluster
- Load balancer (for high availability)
- SSL certificates
- Monitoring and logging infrastructure

### Security Considerations
- Enable authentication and authorization
- Use secure communication (HTTPS/TLS)
- Implement role-based access control
- Regular security updates and patches
- Network segmentation for device access

### Performance Tuning
- Database indexing optimization
- Connection pooling configuration
- Caching strategies
- Background job processing
- Resource monitoring and scaling

## 🧪 Testing

```bash
# Backend tests
cd Backend
npm test

# Frontend tests  
cd FrontEnd
npm test

# Integration tests
npm run test:integration

# Load testing
npm run test:load
```

## 📚 Documentation

- **API Documentation** - Available at `/api/docs` when running
- **Architecture Guide** - `docs/architecture.md`
- **Deployment Guide** - `docs/deployment.md`
- **User Manual** - `docs/user-guide.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Documentation** - Check the docs folder
- **Issues** - Create a GitHub issue
- **Email** - support@networkhealing.com

## 🔄 Version History

- **v1.0.0** - Initial release with core healing capabilities
- **v1.1.0** - Enhanced topology discovery and visualization
- **v1.2.0** - Advanced policy engine and workflow management

---

**Built with ❤️ for network operations teams everywhere**
