// =============================================================================
//  ISEC6000 Secure DevOps - Assessment 2
//  CI/CD pipeline for the Node.js sample application.
//
//  FLOW
//    checkout -> install -> unit tests -> dependency scan -> build -> push
//
//  The scan sits BEFORE the image build on purpose. A gate that runs after
//  publication is not a gate: the vulnerable artefact is already in the
//  registry and something may already have pulled it. Failing here means a
//  build carrying High or Critical dependency vulnerabilities never produces
//  an image at all.
//
//  BEFORE FIRST RUN, set DOCKERHUB_NAMESPACE below, and create two credentials
//  in Jenkins (Manage Jenkins -> Credentials):
//    dockerhub-credentials : Username with password (Docker Hub ACCESS TOKEN)
//    snyk-api-token        : Secret text
// =============================================================================

// Declared outside pipeline{} so the built image handle survives between the
// build stage and the push stage.
def appImage = null

pipeline {

    // The controller executor only orchestrates. Every stage that touches
    // application code runs inside a node:16 container (see the stage agents
    // below); image builds are handed to the isolated DinD daemon over TLS.
    agent any

    options {
        // Task 4 - log and artefact retention. Bounded history keeps the
        // 10 GB disk usable while retaining enough builds to investigate a
        // regression.
        buildDiscarder(logRotator(numToKeepStr: '15', artifactNumToKeepStr: '15'))
        // Every console line gets a timestamp, so the log is usable as
        // evidence of when each stage ran.
        timestamps()
        // A hung docker build must not hold the executor forever.
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    environment {
        // ---- EDIT THIS ----------------------------------------------------
        DOCKERHUB_NAMESPACE = 'your-dockerhub-username'
        // -------------------------------------------------------------------
        IMAGE_REPO = "${DOCKERHUB_NAMESPACE}/isec6000-express-sample"
        IMAGE_TAG  = "${env.BUILD_NUMBER}"
    }

    // -------------------------------------------------------------------------
    //  Each node:16 stage below repeats the same container arguments:
    //    -u 1000:1000 ....... run as an unprivileged user, not root. 1000 is the
    //                         jenkins user, which owns the workspace, so files
    //                         the build writes stay readable afterwards. Reaching
    //                         for `-u root` is the usual fix for a permissions
    //                         error here and it throws away the isolation this
    //                         whole design is marked on.
    //    HOME / npm cache ... redirected to writable paths, because that
    //                         unprivileged user has no home inside the image.
    //  They are written out literally rather than pulled from an environment
    //  variable: agent directives are resolved early, and a variable there is a
    //  classic source of "works on the second stage only" confusion.
    // -------------------------------------------------------------------------

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                sh 'git --no-pager log -1 --pretty=format:"commit %h by %an: %s"'
            }
        }

        stage('Install dependencies') {
            agent {
                docker {
                    image 'node:16'          // build agent pinned by the brief
                    args  '-u 1000:1000 -e HOME=/tmp/nodehome -e npm_config_cache=/tmp/npm-cache'
                    reuseNode true           // share the workspace with later stages
                }
            }
            steps {
                sh 'node --version && npm --version'
                // `npm ci` rather than `npm install`: it installs the exact
                // versions recorded in package-lock.json and fails if the
                // lockfile and manifest disagree. `npm install` would silently
                // resolve newer versions inside the semver ranges, so the tree
                // that was scanned in the security stage might not be the tree
                // that ends up in the published image - which quietly defeats
                // the point of scanning it. It also wipes node_modules first,
                // so a build never inherits state from the previous one.
                sh 'npm ci'
            }
        }

        stage('Unit tests') {
            agent {
                docker {
                    image 'node:16'
                    args  '-u 1000:1000 -e HOME=/tmp/nodehome -e npm_config_cache=/tmp/npm-cache'
                    reuseNode true
                }
            }
            steps {
                sh 'npm test'
            }
            post {
                always {
                    // Machine-readable results give Jenkins a test trend rather
                    // than a wall of console text.
                    junit allowEmptyResults: true, testResults: 'reports/junit/*.xml'
                }
            }
        }

        stage('Dependency vulnerability scan') {
            agent {
                docker {
                    image 'node:16'
                    args  '-u 1000:1000 -e HOME=/tmp/nodehome -e npm_config_cache=/tmp/npm-cache'
                    reuseNode true
                }
            }
            steps {
                withCredentials([string(credentialsId: 'snyk-api-token', variable: 'SNYK_TOKEN')]) {
                    script {
                        // npx rather than `npm install -g`: the agent runs as an
                        // unprivileged user and cannot write to /usr/local/lib.
                        def status = sh(
                            returnStatus: true,
                            script: '''
                                set +x
                                npx --yes snyk@latest auth "$SNYK_TOKEN" >/dev/null 2>&1
                                set -x
                                npx --yes snyk@latest test \
                                    --severity-threshold=high \
                                    --json-file-output=snyk-report.json
                            '''
                        )

                        // Snyk's exit codes are not a simple pass/fail:
                        //   0 = no issues at or above the threshold
                        //   1 = issues found  -> this is the gate firing
                        //   2 = the scan itself failed (bad token, unsupported
                        //       manifest, network). Treating 2 as "clean" would
                        //       silently disable the gate, so it fails too.
                        //   3 = no supported projects detected
                        if (status == 1) {
                            error('SECURITY GATE FAILED: High/Critical dependency ' +
                                  'vulnerabilities detected. See the archived ' +
                                  'snyk-report.json. Remediate before this build ' +
                                  'can produce an image.')
                        } else if (status != 0) {
                            error("SECURITY GATE INCONCLUSIVE: Snyk exited ${status} " +
                                  '(scanner error, not a clean result). Failing ' +
                                  'closed rather than publishing an unscanned image.')
                        }
                        echo 'Security gate passed: no High or Critical issues.'
                    }
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'snyk-report.json',
                                     allowEmptyArchive: true,
                                     fingerprint: true
                }
            }
        }

        stage('Build Docker image') {
            steps {
                script {
                    // Runs on the controller's Docker CLI, which is pointed at
                    // the DinD daemon over TLS - the host daemon is never used.
                    appImage = docker.build("${IMAGE_REPO}:${IMAGE_TAG}", "--pull .")
                }
            }
        }

        stage('Push to registry') {
            steps {
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-credentials') {
                        // Immutable, traceable tag first...
                        appImage.push("${IMAGE_TAG}")
                        // ...then the moving pointer.
                        appImage.push('latest')
                    }
                }
                echo "Published ${IMAGE_REPO}:${IMAGE_TAG} and :latest"
            }
        }
    }

    post {
        always {
            // Archived on every outcome: a failed build's evidence is the
            // evidence that matters most.
            archiveArtifacts artifacts: 'reports/**/*, snyk-report.json',
                             allowEmptyArchive: true
        }
        success {
            echo "BUILD ${env.BUILD_NUMBER} passed all quality and security gates."
        }
        failure {
            echo "BUILD ${env.BUILD_NUMBER} failed. Check which stage stopped it - " +
                 "a scan failure is the pipeline working, not the pipeline broken."
        }
        cleanup {
            // Reclaim disk. The 10 GB budget disappears quickly with DinD layers.
            sh 'docker image prune -f || true'
            cleanWs()
        }
    }
}
