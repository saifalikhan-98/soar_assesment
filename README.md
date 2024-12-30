# School Management System

A comprehensive school management system built with Express.js, featuring secure authentication, role-based access control, and real-time data management capabilities.

## 🚀 Features

- **Dual Portal Access**
  - User Portal (Port: 5111)
  - Admin Portal (Port: 5222)

- **Authentication & Security**
  - JWT-based authentication
  - Bcrypt password hashing
  - Rate limiting protection
  - Helmet security headers

- **Database Integration**
  - MongoDB for persistent storage
  - Redis for caching and session management
  - Oyster DB for specific use cases

- **Real-time Updates**
  - Ion-cortex integration for real-time data sync
  - Aeon-machine for task scheduling

## 🛠️ Tech Stack

- **Backend Framework:** Express.js
- **Databases:**
  - MongoDB (Primary database)
  - Redis (Caching & Sessions)
  - Oyster DB (Specialized storage)
- **Security:** 
  - JWT
  - Bcrypt
  - Helmet
  - TweetNaCl for encryption
- **Development Tools:**
  - ESLint
  - Jest for testing
  - Nodemon for development

## 📋 Prerequisites

- Node.js 20.x
- Docker and Docker Compose
- MongoDB
- Redis

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd soar_assessment
   ```

2. **Environment Setup**
   ```bash
   # Create .env file
   cp .env.example .env
   # Update the variables in .env
   ```

3. **Using Docker (Recommended)**
   ```bash
   # Build and start services
   docker-compose up --build

   # Stop services
   docker-compose down
   ```

4. **Manual Setup**
   ```bash
   # Install dependencies
   yarn install

   # Start development server
   yarn dev

   # Start production server
   yarn start
   ```

## 🔌 API Ports

- **User Portal:** 5111
- **Admin Portal:** 5222

## 📝 Environment Variables

```env
# Server Ports
USER_PORT=5111
ADMIN_PORT=5222

# Database URLs
MONGODB_URI=mongodb://localhost:27017/school_management
REDIS_URI=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret
```

## 🧪 Testing

```bash
# Run tests
yarn test
```

## 🛠️ Development

The project uses ESLint for code quality and formatting. Configuration can be found in `eslint.config.mjs`.

```bash
# Run ESLint
yarn lint

# Fix ESLint issues
yarn lint --fix
```

## 🐳 Docker Support

The project includes Docker support with:
- Multi-stage builds for optimal image size
- Separate development and production configurations
- Automatic container health checks
- Volume mapping for development

## 📁 Project Structure

```
soar_assessment/
├── config/         # Configuration files
├── connect/        # Database connection modules
├── libs/          # Utility libraries
├── loaders/       # Application loaders
├── managers/      # Business logic managers
├── mws/           # Middleware functions
└── cache/         # Cache storage
```

## 🔍 Monitoring & Health Checks

The application includes built-in health checks accessible at:
- User Portal: `http://localhost:5111/health`
- Admin Portal: `http://localhost:5222/health`

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.