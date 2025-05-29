# elytra

## Repository Structure

The repository is composed of several git submodules:

- [/docs](https://github.com/elytra-tqs/docs): Documentation for the project.

## Installation

To install the project, you need to clone the repository and its submodules. You can do this by running the following command:

```bash
git submodule update --init --recursive
```

This command will fetch each submodule and place it in the correct directory.

## Deployment

For production deployment to a VM, see the [Deployment Guide](DEPLOYMENT.md).

The application uses Docker Compose for containerization and GitHub Actions for automated deployment when pull requests are merged to the main branch.
