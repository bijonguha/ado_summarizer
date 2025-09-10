from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import httpx
import base64
import yaml
import logging
import logging.handlers
from datetime import datetime
from pathlib import Path

# Load configuration
config_path = Path(__file__).parent / "config.yaml"
with open(config_path, 'r') as file:
    config = yaml.safe_load(file)

# Setup logging
def setup_logging():
    log_config = config['logging']
    
    # Create logger
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, log_config['level'].upper()))
    
    # Create formatter
    formatter = logging.Formatter(log_config['format'])
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        log_config['file'],
        maxBytes=log_config['max_file_size_mb'] * 1024 * 1024,
        backupCount=log_config['backup_count']
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger

logger = setup_logging()

# Pydantic models for request validation
class AzureDevOpsSettings(BaseModel):
    organization: str
    project: str
    baseUrl: str
    accessToken: str

class TestConnectionRequest(BaseModel):
    organization: str
    project: str
    baseUrl: str
    accessToken: str

app = FastAPI(
    title=config['api']['title'], 
    version=config['api']['version']
)

# Mount static files
static_path = Path(__file__).parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

logger.info(f"Starting {config['api']['title']} v{config['api']['version']}")

# Azure DevOps settings - fallback defaults (primarily used for dynamic configuration now)
azure_config = config.get('azure_devops', {})
AZURE_DEVOPS_ORG = azure_config.get('organization', 'your-org')
AZURE_DEVOPS_PROJECT = azure_config.get('project', 'YourProject')
AZURE_ACCESS_TOKEN = azure_config.get('access_token', 'your-pat-token')
DEFAULT_USER = azure_config.get('default_user', 'user@company.com')
DEFAULT_ITERATION = azure_config.get('default_iteration', 'Project\\Sprint\\Iteration')
DEFAULT_TEAM = azure_config.get('default_team', 'Your Team')
BASE_URL = azure_config.get('base_url', 'https://your-org.visualstudio.com')

def get_auth_header(access_token: str = None):
    token_to_use = access_token or AZURE_ACCESS_TOKEN
    auth_string = f":{token_to_use}"
    token = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
    
    logger.debug(f"Creating auth header for token: {token_to_use[:10]}...")
    logger.debug(f"Auth string: ':{token_to_use[:10]}...'")
    logger.debug(f"Base64 encoded: {token[:20]}...")
    
    return {"Authorization": f"Basic {token}"}

def get_azure_config_from_headers(
    x_azure_organization: Optional[str] = Header(None),
    x_azure_project: Optional[str] = Header(None), 
    x_azure_baseurl: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Extract Azure DevOps config from request headers or fall back to config file"""
    
    # Extract token from Authorization header if present
    access_token = None
    if authorization and authorization.startswith('Basic '):
        try:
            decoded = base64.b64decode(authorization[6:]).decode()
            if decoded.startswith(':'):
                access_token = decoded[1:]
        except:
            pass
    
    return {
        'organization': x_azure_organization or AZURE_DEVOPS_ORG,
        'project': x_azure_project or AZURE_DEVOPS_PROJECT,
        'base_url': x_azure_baseurl or BASE_URL,
        'access_token': access_token or AZURE_ACCESS_TOKEN
    }

@app.get("/")
async def root():
    """Serve the main application page"""
    static_path = Path(__file__).parent / "static" / "index.html"
    if static_path.exists():
        return FileResponse(str(static_path))
    else:
        logger.info("Root endpoint accessed - static files not found, returning API info")
        return {"message": "Azure DevOps Summarizer API", "status": "running"}

@app.get("/work-items")
async def get_work_items(
    assigned_to: str = DEFAULT_USER, 
    iteration: str = DEFAULT_ITERATION,
    x_azure_organization: Optional[str] = Header(None),
    x_azure_project: Optional[str] = Header(None), 
    x_azure_baseurl: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    # Get Azure config from headers or fall back to config file
    azure_config = get_azure_config_from_headers(x_azure_organization, x_azure_project, x_azure_baseurl, authorization)
    
    logger.info(f"Fetching work items for user: {assigned_to}, iteration: {iteration}")
    url = f"{azure_config['base_url']}/{azure_config['project']}/_apis/wit/wiql"
    
    if iteration:
        iteration_filter = f"AND [System.IterationPath] = '{iteration}'"
    else:
        iteration_filter = ""
    
    wiql_query = {
        "query": f"""
        SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.IterationPath], [System.WorkItemType]
        FROM WorkItems 
        WHERE [System.AssignedTo] = '{assigned_to}'
        """
    }
    
    headers = get_auth_header(azure_config['access_token'])
    headers["Content-Type"] = "application/json"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{url}?api-version=7.0", json=wiql_query, headers=headers)
            response.raise_for_status()
            
            work_item_ids = [item["id"] for item in response.json()["workItems"]]
            logger.info(f"Found {len(work_item_ids)} work items from WIQL query")
            
            if not work_item_ids:
                logger.info("No work items found")
                return {"work_items": [], "count": 0}
            
            ids_string = ",".join(map(str, work_item_ids))
            details_url = f"{azure_config['base_url']}/{azure_config['project']}/_apis/wit/workitems"
            
            details_response = await client.get(
                f"{details_url}?ids={ids_string}&api-version=7.0",
                headers=get_auth_header(azure_config['access_token'])
            )
            details_response.raise_for_status()
            
            work_items = details_response.json()["value"]
            
            simplified_items = []
            for item in work_items:
                fields = item["fields"]
                item_iteration = fields.get("System.IterationPath", "")
                
                # Filter by iteration if specified
                if iteration and iteration not in item_iteration:
                    continue
                    
                simplified_items.append({
                    "id": item["id"],
                    "title": fields.get("System.Title"),
                    "state": fields.get("System.State"),
                    "assigned_to": fields.get("System.AssignedTo", {}).get("displayName"),
                    "work_item_type": fields.get("System.WorkItemType"),
                    "iteration": item_iteration,
                    "created_date": fields.get("System.CreatedDate"),
                    "url": item["url"]
                })
            
            logger.info(f"Successfully fetched {len(simplified_items)} work items after filtering")
            return {
                "work_items": simplified_items,
                "count": len(simplified_items),
                "filters": {
                    "assigned_to": assigned_to,
                    "iteration": iteration
                }
            }
            
    except httpx.HTTPStatusError as e:
        logger.error(f"Azure DevOps API error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Azure DevOps API error: {e.response.text}")
    except Exception as e:
        logger.error(f"Internal server error in work-items endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/work-item-details")
async def get_work_item_details(
    work_item_id: str,
    x_azure_organization: Optional[str] = Header(None),
    x_azure_project: Optional[str] = Header(None), 
    x_azure_baseurl: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Get detailed information for work items. Pass single ID or comma-separated IDs (e.g., '537902' or '537902,537904,537919')"""
    try:
        # Get Azure config from headers or fall back to config file
        azure_config = get_azure_config_from_headers(x_azure_organization, x_azure_project, x_azure_baseurl, authorization)
        
        # Parse comma-separated IDs
        work_item_ids = [id.strip() for id in work_item_id.split(',')]
        logger.info(f"Fetching detailed information for work items: {work_item_ids}")
        all_work_items = []
        
        async with httpx.AsyncClient() as client:
            for single_id in work_item_ids:
                try:
                    # Get the main work item details
                    work_item_url = f"{azure_config['base_url']}/{azure_config['project']}/_apis/wit/workitems/{single_id}"
                    response = await client.get(f"{work_item_url}?$expand=all&api-version=7.0", headers=get_auth_header(azure_config['access_token']))
                    response.raise_for_status()
            
                    work_item = response.json()
                    fields = work_item["fields"]
                    
                    # Get comments
                    comments_url = f"{azure_config['base_url']}/{azure_config['project']}/_apis/wit/workitems/{single_id}/comments"
                    comments_response = await client.get(f"{comments_url}?api-version=7.0", headers=get_auth_header(azure_config['access_token']))
                    comments = []
                    if comments_response.status_code == 200:
                        comments_data = comments_response.json()
                        comments = [
                            {
                                "id": comment["id"],
                                "text": comment["text"],
                                "created_by": comment.get("createdBy", {}).get("displayName"),
                                "created_date": comment.get("createdDate")
                            }
                            for comment in comments_data.get("comments", [])
                        ]
                    
                    # Get child work items
                    child_items = []
                    relations = work_item.get("relations", [])
                    child_ids = []
                    
                    for relation in relations:
                        if relation.get("rel") == "System.LinkTypes.Hierarchy-Forward":
                            # Extract ID from URL like: https://cgna-stg.visualstudio.com/.../workItems/123456
                            child_url = relation.get("url", "")
                            if "/workItems/" in child_url:
                                child_id = child_url.split("/workItems/")[-1]
                                child_ids.append(child_id)
                    
                    if child_ids:
                        ids_string = ",".join(child_ids)
                        children_url = f"{azure_config['base_url']}/{azure_config['project']}/_apis/wit/workitems"
                        children_response = await client.get(
                            f"{children_url}?ids={ids_string}&api-version=7.0",
                            headers=get_auth_header(azure_config['access_token'])
                        )
                        if children_response.status_code == 200:
                            children_data = children_response.json()
                            for child in children_data.get("value", []):
                                child_fields = child["fields"]
                                child_items.append({
                                    "id": child["id"],
                                    "title": child_fields.get("System.Title"),
                                    "state": child_fields.get("System.State"),
                                    "work_item_type": child_fields.get("System.WorkItemType"),
                                    "assigned_to": child_fields.get("System.AssignedTo", {}).get("displayName"),
                                    "description": child_fields.get("System.Description", "").replace("<div>", "").replace("</div>", "").replace("<br>", "\n") if child_fields.get("System.Description") else None
                                })
                    
                    # Clean HTML from description and acceptance criteria
                    description = fields.get("System.Description", "")
                    if description:
                        description = description.replace("<div>", "").replace("</div>", "").replace("<br>", "\n").replace("&nbsp;", " ")
                    
                    acceptance_criteria = fields.get("Microsoft.VSTS.Common.AcceptanceCriteria", "")
                    if acceptance_criteria:
                        acceptance_criteria = acceptance_criteria.replace("<div>", "").replace("</div>", "").replace("<br>", "\n").replace("&nbsp;", " ")
                    
                    work_item_detail = {
                        "id": work_item["id"],
                        "title": fields.get("System.Title"),
                        "description": description,
                        "acceptance_criteria": acceptance_criteria,
                        "state": fields.get("System.State"),
                        "work_item_type": fields.get("System.WorkItemType"),
                        "assigned_to": fields.get("System.AssignedTo", {}).get("displayName"),
                        "created_by": fields.get("System.CreatedBy", {}).get("displayName"),
                        "created_date": fields.get("System.CreatedDate"),
                        "changed_date": fields.get("System.ChangedDate"),
                        "iteration": fields.get("System.IterationPath"),
                        "area": fields.get("System.AreaPath"),
                        "priority": fields.get("Microsoft.VSTS.Common.Priority"),
                        "story_points": fields.get("Microsoft.VSTS.Scheduling.StoryPoints"),
                        "tags": fields.get("System.Tags"),
                        "comments": comments,
                        "child_work_items": child_items,
                        "child_count": len(child_items),
                        "url": work_item["url"]
                    }
                    
                    all_work_items.append(work_item_detail)
                    
                except Exception as e:
                    all_work_items.append({
                        "id": single_id,
                        "error": f"Failed to fetch details: {str(e)}"
                    })
            
            # Return single item if only one ID, otherwise return list
            logger.info(f"Successfully processed {len(all_work_items)} work items")
            if len(work_item_ids) == 1:
                return all_work_items[0] if all_work_items else {"error": "No work items found"}
            else:
                return {
                    "work_items": all_work_items,
                    "count": len(all_work_items)
                }
            
    except httpx.HTTPStatusError as e:
        logger.error(f"Azure DevOps API error in work-item-details: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Azure DevOps API error: {e.response.text}")
    except Exception as e:
        logger.error(f"Internal server error in work-item-details endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/my-iterations")
async def get_my_iterations(
    assigned_to: str = DEFAULT_USER,
    x_azure_organization: Optional[str] = Header(None),
    x_azure_project: Optional[str] = Header(None), 
    x_azure_baseurl: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Get unique iterations from your work items"""
    # Get Azure config from headers or fall back to config file
    azure_config = get_azure_config_from_headers(x_azure_organization, x_azure_project, x_azure_baseurl, authorization)
    
    logger.info(f"Fetching iterations for user: {assigned_to}")
    url = f"{azure_config['base_url']}/{azure_config['project']}/_apis/wit/wiql"
    
    wiql_query = {
        "query": f"""
        SELECT [System.Id], [System.IterationPath]
        FROM WorkItems 
        WHERE [System.AssignedTo] = '{assigned_to}'
        """
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{url}?api-version=7.0", json=wiql_query, headers=get_auth_header(azure_config['access_token']))
            response.raise_for_status()
            
            work_item_ids = [item["id"] for item in response.json()["workItems"]]
            
            if not work_item_ids:
                return {"iterations": [], "count": 0}
            
            ids_string = ",".join(map(str, work_item_ids))
            details_url = f"{azure_config['base_url']}/{azure_config['project']}/_apis/wit/workitems"
            
            details_response = await client.get(
                f"{details_url}?ids={ids_string}&fields=System.IterationPath&api-version=7.0",
                headers=get_auth_header(azure_config['access_token'])
            )
            details_response.raise_for_status()
            
            work_items = details_response.json()["value"]
            iterations = set()
            
            for item in work_items:
                iteration_path = item["fields"].get("System.IterationPath")
                if iteration_path:
                    iterations.add(iteration_path)
            
            sorted_iterations = sorted(list(iterations))
            
            logger.info(f"Found {len(sorted_iterations)} unique iterations for user")
            return {
                "iterations": [
                    {
                        "path": iteration,
                        "name": iteration.split("\\")[-1] if "\\" in iteration else iteration,
                        "is_active": "Active" in iteration
                    }
                    for iteration in sorted_iterations
                ],
                "count": len(sorted_iterations)
            }
            
    except httpx.HTTPStatusError as e:
        logger.error(f"Azure DevOps API error in my-iterations: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Azure DevOps API error: {e.response.text}")
    except Exception as e:
        logger.error(f"Internal server error in my-iterations endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/test-connection")
async def test_connection(settings: TestConnectionRequest):
    """Test Azure DevOps connection with provided settings"""
    logger.info(f"Testing connection to {settings.organization}/{settings.project}")
    logger.info(f"Base URL: {settings.baseUrl}")
    logger.info(f"Access Token length: {len(settings.accessToken)}")
    logger.info(f"Access Token starts with: {settings.accessToken[:10]}...")
    
    # Ensure base URL has protocol
    base_url = settings.baseUrl
    if not base_url.startswith(('http://', 'https://')):
        base_url = f"https://{base_url}"
        logger.info(f"Added https:// protocol to base URL: {base_url}")
    
    try:
        # Test with the same query the app actually uses - filter by user first
        url = f"{base_url}/{settings.project}/_apis/wit/wiql"
        headers = get_auth_header(settings.accessToken)
        headers["Content-Type"] = "application/json"
        
        # Use a test user query (same as the real app) - this will have much fewer results
        test_user = "test@example.com"  # Default test user
        test_query = {
            "query": f"SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = '{test_user}'"
        }
        
        logger.info(f"Request URL: {url}")
        logger.info(f"Request headers (Authorization): {headers.get('Authorization', 'Missing')[:30]}...")
        logger.info(f"Test query: {test_query['query']}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{url}?api-version=7.0", json=test_query, headers=headers)
            response.raise_for_status()
            
            logger.info("Connection test successful")
            return {"status": "success", "message": "Connection successful"}
            
    except httpx.HTTPStatusError as e:
        logger.error(f"Connection test failed - HTTP {e.response.status_code}: {e.response.text}")
        
        # Check if it's a query size limit error - this actually means connection works!
        if e.response.status_code == 400 and "size limit" in e.response.text:
            logger.info("Query size limit error - this means connection is working!")
            return {"status": "success", "message": "Connection successful (large dataset detected)"}
        
        if e.response.status_code == 401:
            error_details = "Invalid Personal Access Token (PAT) or insufficient permissions. Please check:\n"
            error_details += "1. Your PAT is not expired\n"
            error_details += "2. Your PAT has 'Project and Team (read)' permissions\n"
            error_details += "3. You have access to the organization and project"
            raise HTTPException(status_code=400, detail=error_details)
        elif e.response.status_code == 404:
            raise HTTPException(status_code=400, detail="Project or organization not found. Please verify the organization name and project name are correct.")
        else:
            raise HTTPException(status_code=400, detail=f"Azure DevOps API error: {e.response.text}")
    except Exception as e:
        logger.error(f"Connection test failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")

@app.get("/health")
async def health_check():
    logger.debug("Health check endpoint accessed")
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on {config['api']['host']}:{config['api']['port']}")
    uvicorn.run(app, host=config['api']['host'], port=config['api']['port'])