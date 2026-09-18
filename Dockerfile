# =============================================================================
#  Runtime image for the Express sample application.
#  Built and pushed by the Jenkins pipeline (see Jenkinsfile).
# =============================================================================

# Alpine keeps the image small, which means a smaller attack surface and fewer
# OS packages for the scanner to flag. Node 16 matches the build agent, so what
# is tested is what ships.
FROM node:16-alpine

WORKDIR /usr/src/app

# Copy the manifest first and install separately from the source. Docker caches
# this layer, so editing app.js does not re-download the dependency tree.
# --chown means the files are owned by the unprivileged `node` user that the
# container will actually run as.
COPY --chown=node:node package*.json ./

# Production dependencies only: test tooling has no business in a runtime image.
RUN npm install --omit=dev && npm cache clean --force

COPY --chown=node:node . .

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

# Drop privileges before the application starts. A container process running as
# root is root in the container, and one kernel or runtime flaw away from root
# on the host. The `node` user ships with the official image.
USER node

CMD ["node", "app.js"]
