# elytra

## Repository Structure

The repository is composed of several git submodules:

- [/docs](https://github.com/elytra-tqs/docs): Documentation for the project.
- [/frontend](https://github.com/elytra-tqs/frontend): React + TypeScript frontend application.
- [/stations-management](https://github.com/elytra-tqs/stations-management): Spring Boot backend service.

## Installation

To install the project, you need to clone the repository and its submodules. You can do this by running the following command:

```bash
git submodule update --init --recursive
```

This command will fetch each submodule and place it in the correct directory.

## Development

To run the project in development mode:

```bash
docker-compose up -d
```

This will start all services including the application, database, and monitoring stack.

## Production

To deploy in production:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

The production deployment includes NGINX reverse proxy, MySQL database, and monitoring services.
