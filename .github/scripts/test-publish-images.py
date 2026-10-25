"""Exercise publishing against real temporary repositories (no GitHub writes)."""
import importlib.util
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("publish_images", Path(__file__).with_name("publish-images.py"))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.remote = root / "remote.git"
        self.work = root / "work"
        self.other = root / "other"
        subprocess.run(["git", "init", "--bare", str(self.remote)], check=True, capture_output=True)
        subprocess.run(["git", "clone", str(self.remote), str(self.work)], check=True, capture_output=True)
        self.old_cwd = Path.cwd()
        os.chdir(self.work)
        self.addCleanup(os.chdir, self.old_cwd)
        publisher.git("config", "user.name", "Test")
        publisher.git("config", "user.email", "test@example.com")
        publisher.git("checkout", "-b", "main")
        Path("kubernetes").mkdir()
        for component in ("frontend", "backend"):
            Path(f"kubernetes/{component}-deployment.yaml").write_text(
                f'image: ghcr.io/owner/portfolio-{component}:old\n'
                'portfolio.pratyushes.dev/deploy-sha: "old"\n', encoding="utf-8")
        Path("app.js").write_text("v1", encoding="utf-8")
        self.build = self.commit("initial")
        publisher.git("push", "origin", "main")
        subprocess.run(["git", "clone", "--branch", "main", str(self.remote), str(self.other)], check=True, capture_output=True)
        self.other_git("config", "user.name", "Other")
        self.other_git("config", "user.email", "other@example.com")

    def commit(self, message):
        publisher.git("add", ".")
        publisher.git("commit", "-m", message)
        return publisher.git("rev-parse", "HEAD").stdout.strip()

    def other_git(self, *args):
        return subprocess.run(["git", "-C", str(self.other), *args], check=True, capture_output=True, text=True)

    def advance(self, file, content):
        (self.other / file).write_text(content, encoding="utf-8")
        self.other_git("add", ".")
        self.other_git("commit", "-m", "concurrent update")
        self.other_git("push", "origin", "main")

    def test_publish_and_rerun(self):
        revision = publisher.publish(self.build, "Owner")
        self.assertNotEqual(revision, self.build)
        self.assertIn(f"portfolio-backend:{self.build}", Path("kubernetes/backend-deployment.yaml").read_text())
        self.assertEqual(publisher.publish(self.build, "Owner"), revision)

    def test_newer_source_is_not_rolled_back(self):
        self.advance("app.js", "v2")
        self.assertIsNone(publisher.publish(self.build, "Owner"))

    def test_manifest_edits_are_preserved(self):
        self.advance("kubernetes/ingress.yaml", "new ingress")
        self.assertIsNotNone(publisher.publish(self.build, "Owner"))
        self.assertEqual(Path("kubernetes/ingress.yaml").read_text(), "new ingress")

    def race(self, file):
        real_git = publisher.git
        raced = False

        def git(*args, **kwargs):
            nonlocal raced
            if args[0] == "push" and not raced:
                raced = True
                self.advance(file, "concurrent change")
            return real_git(*args, **kwargs)

        with patch.object(publisher, "git", side_effect=git):
            return publisher.publish(self.build, "Owner")

    def test_push_race_retries_from_latest_manifest(self):
        self.assertIsNotNone(self.race("kubernetes/ingress.yaml"))
        self.assertEqual(Path("kubernetes/ingress.yaml").read_text(), "concurrent change")

    def test_push_race_with_new_source_skips_old_build(self):
        self.assertIsNone(self.race("app.js"))


if __name__ == "__main__":
    unittest.main()
