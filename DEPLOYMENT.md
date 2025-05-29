# Deployment Guide

This guide explains how to deploy the Elytra application to your VM using GitHub Actions and SSH deployment keys.

## Prerequisites

1. A VM with Docker and Docker Compose installed
2. Git installed on the VM
3. SSH access to the VM
4. The repository cloned on the VM

## Setup Instructions

### 1. Generate SSH Deployment Key

On your local machine, generate a new SSH key pair for deployment:

```bash
ssh-keygen -t ed25519 -C "elytra-deployment" -f ~/.ssh/elytra_deploy_key
```

This creates two files:

- `~/.ssh/elytra_deploy_key` (private key)
- `~/.ssh/elytra_deploy_key.pub` (public key)

### 2. Configure VM

1. Copy the public key to your VM:

```bash
ssh-copy-id -i ~/.ssh/elytra_deploy_key.pub user@your-vm-ip
```

2. On your VM, clone the repository if not already done:

```bash
git clone https://github.com/your-username/elytra.git /path/to/deployment
cd /path/to/deployment
git submodule update --init --recursive
```

3. Ensure Docker and Docker Compose are installed and the user can run Docker commands:

```bash
sudo usermod -aG docker $USER
```

### 3. Configure GitHub Secrets

In your GitHub repository, go to Settings > Secrets and variables > Actions, and add these secrets:

- `DEPLOY_SSH_KEY`: The content of your private key file (`~/.ssh/elytra_deploy_key`)
- `VM_HOST`: Your VM's IP address or hostname
- `VM_USER`: The username to SSH into your VM
- `VM_DEPLOY_PATH`: The path where the repository is cloned on your VM (e.g., `/home/user/elytra`)

### 4. Test Deployment

1. Create a pull request and merge it to the `main` branch
2. The GitHub Action will automatically trigger and deploy to your VM
3. Check the Actions tab in GitHub to monitor the deployment progress

## Manual Deployment

If you need to deploy manually, you can SSH into your VM and run:

```bash
cd /path/to/your/deployment
git pull origin main
git submodule update --init --recursive
./deploy.sh
```

## Troubleshooting

### SSH Connection Issues

- Verify the SSH key is correctly added to GitHub secrets
- Ensure the VM's SSH service is running
- Check that the deployment user has the necessary permissions

### Docker Issues

- Ensure Docker is running: `sudo systemctl status docker`
- Check Docker Compose version compatibility
- Verify the user is in the docker group: `groups $USER`

### Application Issues

- Check container logs: `docker compose -f docker-compose.prod.yml logs`
- Verify all required environment variables are set
- Ensure ports are not already in use

## Security Notes

- The deployment key should only have access to the specific repository
- Consider using a dedicated deployment user on your VM
- Regularly rotate deployment keys
- Monitor deployment logs for any suspicious activity
