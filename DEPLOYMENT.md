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
container serves its port (backend) or index page (frontend). Browser navigations
revalidate `index.html` so they discover the latest hashed JavaScript bundles.

If images do not advance, check the workflow's publishing job first. If pods
cannot start, inspect namespace events, registry pull credentials, and resource
availability; this rolling strategy needs capacity for a temporary extra pod.
