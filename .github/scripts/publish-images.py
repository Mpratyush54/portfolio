"""Publish built images from an isolated CI checkout, preserving newer Git changes."""
import os
import re
import subprocess
from pathlib import Path


def git(*args, check=True):
    return subprocess.run(["git", *args], check=check, capture_output=True, text=True)


def pin_images(sha, owner):
    for component in ("frontend", "backend"):
        path = Path(f"kubernetes/{component}-deployment.yaml")
        content = path.read_text(encoding="utf-8")
        content, images = re.subn(
            rf"(?m)^(\s*image:) ghcr\.io/[^/]+/portfolio-{component}:[^\s]+$",
            rf"\1 ghcr.io/{owner}/portfolio-{component}:{sha}", content,
        )
        content, annotations = re.subn(
            r'(?m)^(\s*portfolio\.pratyushes\.dev/deploy-sha:) "[^"]*"$',
            rf'\1 "{sha}"', content,
        )
        if images != 1 or annotations != 1:
            raise ValueError(f"Expected exactly one image and deploy annotation in {path}")
        path.write_text(content, encoding="utf-8", newline="\n")


def publish(sha, owner):
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("BUILD_SHA must be a full Git SHA")
    owner = owner.lower()
    if not re.fullmatch(r"[a-z0-9-]+", owner):
        raise ValueError("Invalid image owner")
    if git("status", "--porcelain").stdout.strip():
        raise RuntimeError("Publishing requires a clean checkout")

    for _ in range(3):
        git("fetch", "origin", "main")
        # A slow older build must never roll back newer application code. Changes
        # confined to manifests/docs can safely keep their latest Git versions.
        result = git("diff", "--quiet", sha, "origin/main", "--", ".",
                     ":(exclude)kubernetes/**", ":(exclude)**.md", check=False)
        if result.returncode == 1:
            print("Skipping obsolete build: main has newer source changes.")
            return None
        result.check_returncode()
        git("checkout", "-B", "manifest-publish", "origin/main")
        pin_images(sha, owner)
        git("add", "kubernetes/frontend-deployment.yaml", "kubernetes/backend-deployment.yaml")
        diff = git("diff", "--cached", "--quiet", check=False)
        if diff.returncode == 0:
            return git("rev-parse", "HEAD").stdout.strip()
        if diff.returncode != 1:
            diff.check_returncode()
        git("-c", "user.name=github-actions[bot]", "-c",
            "user.email=41898282+github-actions[bot]@users.noreply.github.com",
            "commit", "-m", f"chore: pin k8s images to {sha}")
        pushed = git("push", "origin", "HEAD:refs/heads/main", check=False)
        if pushed.returncode == 0:
            return git("rev-parse", "HEAD").stdout.strip()
        print(pushed.stderr)
        # On a competing push, fetch and re-check source before trying again.
    raise RuntimeError("Could not publish image pins after three attempts")


if __name__ == "__main__":
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise SystemExit("Run only in an isolated GitHub Actions checkout")
    revision = publish(os.environ["BUILD_SHA"], os.environ["IMAGE_OWNER"])
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write(f"published={'true' if revision else 'false'}\n")
