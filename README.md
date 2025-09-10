# Azure DevOps Summarizer

A modern web application that provides a user-friendly interface for managing and exporting Azure DevOps work items. Features include dynamic configuration, comprehensive work item details, markdown export, and user-specific filtering.

## ✨ Features

- 🌐 **Modern Web UI**: Clean, responsive interface with real-time health monitoring
- ⚙️ **Dynamic Configuration**: Configure Azure DevOps settings through the UI or upload YAML config files
- 📊 **Detailed Work Items**: Complete work item information including descriptions, acceptance criteria, comments, and child items
- 📝 **Markdown Export**: Export work items with full details to markdown files
- 🔐 **Secure Authentication**: Personal Access Token-based authentication with connection testing
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 🔍 **Smart Filtering**: User-specific work item filtering with iteration support

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Application
```bash
python main.py
```

### 3. Configure via Web UI
1. Open `http://localhost:8000` in your browser
2. Click **⚙️ Settings** in the header  
3. Fill in your Azure DevOps configuration:
   - Organization name
   - Project name
   - Base URL (e.g., `https://your-org.visualstudio.com`)
   - Personal Access Token
4. Click **🔍 Test & Save Settings**
5. Start using the application!

## 🔧 Configuration Options

### Option 1: Web UI Configuration (Recommended)
Use the built-in settings interface to configure your Azure DevOps connection. Settings are automatically saved and validated.

### Option 2: YAML File Upload
Upload your existing `config.yaml` file through the web interface to auto-populate all settings.

### Option 3: Traditional Config File (Legacy)
Create a `config.yaml` file (copy from `config.yaml.example`):
```yaml
azure_devops:
  organization: "your-org"
  project: "YourProject"
  access_token: "your-pat-token"
  base_url: "https://your-org.visualstudio.com"
  default_user: "user@company.com"
  default_team: "Your Team"
  default_iteration: "Project\\Sprint\\Iteration"
```

## 🖥️ Web Interface

### Main Features
- **Work Item Summary**: View all your assigned work items with filtering by iteration
- **Export Functionality**: Export work items to detailed markdown reports  
- **Settings Management**: Configure Azure DevOps connection through intuitive UI
- **Health Monitoring**: Real-time connection status indicator
- **Connection Testing**: Validate settings before saving

### Export Features
The markdown export includes:
- Complete work item details (ID, title, description, acceptance criteria)
- Timeline information (created, modified, iteration, area)
- Child work items with full details
- All comments with authors and timestamps
- Direct links back to Azure DevOps

## 🔌 API Endpoints

### Web Interface
- **GET /** - Main application interface
- **POST /test-connection** - Test Azure DevOps connection settings

### Work Items API
- **GET /work-items** - Fetch work items with user and iteration filtering
- **GET /work-item-details** - Get comprehensive work item details
- **GET /my-iterations** - List available iterations for a user

### System
- **GET /health** - Application health check

### API Documentation
Interactive API documentation available at `http://localhost:8000/docs` (Swagger UI)

## 🛠️ Technical Features

- **Modern Web Stack**: FastAPI backend with responsive HTML/CSS/JS frontend
- **Dynamic Configuration**: Live configuration updates without server restart
- **Connection Testing**: Smart health checks with detailed error diagnostics
- **Secure Storage**: Local browser storage for settings with fallback to config files
- **Error Recovery**: Comprehensive error handling with user-friendly recommendations
- **Logging**: Detailed request/response logging for troubleshooting
- **YAML Support**: Native YAML config file parsing and validation

## 📋 Requirements

- **Python 3.7+**
- **Azure DevOps Personal Access Token** with the following permissions:
  - `Project and Team (read)`  
  - `Work Items (read)`
- **Network access** to your Azure DevOps organization
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

## Sample Responses

### Work Items Response
```json
{
  "work_items": [
    {
      "id": 537902,
      "title": "Restructuring code of Streaming-My-Dining for merging Analytics",
      "state": "Active",
      "assigned_to": "Guha, Bijon",
      "work_item_type": "User Story",
      "iteration": "HDL\\FY25.Q4 (Active)\\Iteration 5 (Aug 27)",
      "created_date": "2025-08-21T12:18:52.063Z",
      "url": "https://cgna-stg.visualstudio.com/..."
    }
  ],
  "count": 1,
  "filters": {
    "assigned_to": "user@company.com",
    "iteration": "Project\\Sprint 1"
  }
}
```

### Work Item Details Response
```json
{
  "id": 537902,
  "title": "Restructuring code for Analytics integration",
  "description": "Detailed description of the work item...",
  "acceptance_criteria": "- Criteria 1\n- Criteria 2",
  "state": "Active",
  "work_item_type": "User Story",
  "assigned_to": "User Name",
  "comments": [
    {
      "id": 123,
      "text": "Comment text...",
      "created_by": "User Name",
      "created_date": "2025-08-21T12:18:52.063Z"
    }
  ],
  "child_work_items": [
    {
      "id": 537931,
      "title": "Task 1",
      "state": "Closed",
      "work_item_type": "Task"
    }
  ],
  "child_count": 1
}
```

## 🔧 Personal Access Token Setup

1. **Go to Azure DevOps** → User Settings → Personal Access Tokens
2. **Click "New Token"**
3. **Set Scopes**:
   - ✅ `Project and Team (read)`
   - ✅ `Work Items (read)`
4. **Set Expiration** (recommend 1 year)
5. **Copy Token** (save immediately - it won't be shown again!)
6. **Use in Application** via Settings UI or config file

## 🐳 Docker Support

```bash
# Build the image
docker build -t ado-summarizer .

# Run with config file
docker run -p 8000:8000 -v $(pwd)/config.yaml:/app/config.yaml ado-summarizer

# Or run and configure via web UI
docker run -p 8000:8000 ado-summarizer
```

## 🔍 Troubleshooting

### Connection Issues
- Verify your organization and project names are correct
- Check PAT token hasn't expired
- Ensure PAT has required permissions
- Test connection through Settings → Test Connection

### Large Dataset Issues
- Use iteration filtering to reduce result sets
- The app automatically filters by user first to optimize performance

### Configuration Issues  
- Use the web UI for easier configuration
- Upload YAML files to auto-populate settings
- Check browser console for detailed error messages

## 📝 Logging

Application logs include request/response details for debugging:
- **Console Output**: Real-time application events
- **File Logging**: Persistent logs with rotation (`app.log`)
- **Health Monitoring**: Connection status tracking
- **Debug Mode**: Detailed request/response logging available