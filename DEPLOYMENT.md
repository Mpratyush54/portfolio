# Portfolio deployments

Push application changes to `main`. GitHub Actions builds both ARM64 images,
then commits their full Git SHA tags to the deployment manifests. Argo CD polls
`main` and automatically rolls the pods. No manual pod deletion or server restart
is required. A successful image build alone does not mean the rollout is finished;
the manifest publishing job must succeed too.

The publisher serializes manifest writes, preserves current Kubernetes settings,
retries competing pushes, and skips builds whose application sources are obsolete.
Manual workflow dispatch on `main` also publishes image pins. Pull requests build
without logging in to GHCR or publishing images.

Argo normally discovers changes within roughly three minutes after the image-pin
commit, in addition to build time. No GitHub App is required. Optional Actions
secrets `ARGOCD_SERVER` (HTTPS URL or hostname) and `ARGOCD_AUTH_TOKEN` enable an
immediate refresh; automated sync still chooses the current revision.

## Bootstrap or change the Application configuration

The Application is excluded from its own sync directory. Apply changes to that
file explicitly once using an authenticated cluster session:

```sh
kubectl apply -n argocd -f kubernetes/argocd-app.yaml
```

When migrating an Application that previously managed itself, remove its old
tracking annotation once, then refresh it. This migration was completed on the
current portfolio cluster on 26 October 2026:

```sh
kubectl annotate application portfolio -n argocd argocd.argoproj.io/tracking-id-
kubectl annotate application portfolio -n argocd argocd.argoproj.io/refresh=hard --overwrite
```

## Verify a rollout

```sh
kubectl get application portfolio -n argocd
kubectl rollout status deployment/backend -n portfolio --timeout=120s
kubectl rollout status deployment/frontend -n portfolio --timeout=120s
kubectl get deployments -n portfolio -o wide
```

Expect `Synced` / `Healthy`, the new image SHA, and one ready replica per
deployment. Readiness checks prevent replacing the old replica before the new
container has connected to MongoDB and initialized booking storage (backend), or serves its index page (frontend). Browser navigations
revalidate `index.html` so they discover the latest hashed JavaScript bundles.

If images do not advance, check the workflow's publishing job first. If pods
cannot start, inspect namespace events, registry pull credentials, and resource
availability; this rolling strategy needs capacity for a temporary extra pod.


## Production environment

Runtime credentials are read from `portfolio-secrets` in the `portfolio` namespace. Keep `.env` out of Git and container build contexts. Non-Razorpay local settings were transferred directly over the authenticated SSH connection for this release, with values verified without printing them. Secret-backed environment variables are loaded when the new backend pod starts; this release's image update provides that rollout. Later standalone Secret changes need a backend rollout to refresh environment variables. Razorpay keys and webhook secrets were deliberately not configured, so booking shows the email contact option and quotation checkout stays disabled.

Both containers use Node 22 for the application build/runtime, matching CI. Backend readiness checks `/api/health` and keeps the old replica serving until MongoDB and booking indexes are ready. Liveness uses the TCP port so a temporary database outage does not cause restart loops. Returning desktop browsers revalidate model assets instead of indefinitely reusing Cache API bytes from an earlier release; cached bytes still serve as an offline fallback.
