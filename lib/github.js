"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.__test__ = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _gitUrlParse = require("git-url-parse");

var _gitUrlParse2 = _interopRequireDefault(_gitUrlParse);

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _rest = require("@octokit/rest");

var _rest2 = _interopRequireDefault(_rest);

var _package = require("../package.json");

var _package2 = _interopRequireDefault(_package);

var _compare = require("./compare");

var _readPackageTree = require("./promise/read-package-tree");

var _readPackageTree2 = _interopRequireDefault(_readPackageTree);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function toTag(tags, version) {
    let v = `v${version}`;
    if (tags.has(v)) {
        return v;
    }
    return tags.has(version) && version;
}

function diffURL(cm, to) {
    if (cm.repo) {
        if (cm.current === to) {
            let tag = toTag(cm.tags, cm.current);
            return tag && `${cm.repo}/tree/${tag}`;
        }
        let ft = toTag(cm.tags, cm.current);
        let tt = toTag(cm.tags, to);
        return ft && tt && `${cm.repo}/compare/${ft}...${tt}`;
    }
    return "";
}

function versionRange(current, to) {
    if (current === to) {
        return current;
    }
    return `${current}...${to}`;
}

class CompareModel {
    constructor(a) {
        var _a = _slicedToArray(a, 5);

        this.name = _a[0];
        this.current = _a[1];
        this.wanted = _a[2];
        this.latest = _a[3];
        this.packageType = _a[4];

        this.repo = "";
        this.homepage = "";
        this.tags = new Set();
    }

    rangeWanted() {
        return versionRange(this.current, this.wanted);
    }

    rangeLatest() {
        return versionRange(this.current, this.latest);
    }

    diffWantedURL() {
        return diffURL(this, this.wanted);
    }

    diffLatestURL() {
        return diffURL(this, this.latest);
    }
}

function selectGetTagsPromise(LOG, github, c) {
    if (c.repo) {
        let url = (0, _gitUrlParse2.default)(c.repo);
        if (url.owner && url.name) {
            LOG(`BEGIN getTags from ${url.toString("https")}`);
            let request = { owner: url.owner, repo: url.name, namespace: "tags/" };
            return github.paginate("GET /repos/:owner/:repo/git/refs/:namespace", request, response => response.data.map(t => t.ref.split("/")[2])).then(tags => {
                LOG(`END   getTags ${tags}`);
                c.tags = new Set(tags);
                return c;
            }, err => {
                LOG(`END   getTags ${request} ${err}`);
                return c;
            });
        }
    }
    return Promise.resolve(c);
}

function reconcile(LOG, github, dep, c) {
    LOG(`BEGIN reconcile CompareModel ${c.name}`);
    c.homepage = dep.homepage;
    if (dep.repository) {
        if (dep.repository.url) {
            let u = (0, _gitUrlParse2.default)(dep.repository.url);
            c.repo = u && u.toString("https").replace(/\.git$/, "");
        }
        if (_lodash2.default.isString(dep.repository) && 2 === dep.split("/")) {
            c.repo = `https://github.com/${dep.repository}`;
        }
    }
    return c.shadow ? Promise.resolve(c) : selectGetTagsPromise(LOG, github, c).then(c => {
        LOG(`END   reconcile CompareModel ${c.name}`);
        return c;
    });
}

function toCompareModels(LOG, github, cwd, diff) {
    let map = new Map(diff.map(d => {
        let c = new CompareModel(d);
        return [c.name, c];
    }));
    LOG("BEGIN read-package-tree");
    return (0, _readPackageTree2.default)(cwd, (n, k) => map.get(k)).then(data => {
        LOG("END   read-package-tree");
        let ps = data.children.map(e => reconcile(LOG, github, e.package, map.get(e.package.name)));
        return Promise.all(ps).then(() => map);
    });
}

// for tesing purpose
const __test__ = exports.__test__ = [CompareModel, diffURL, toTag, versionRange];

exports.default = class {
    constructor(options, remote) {
        this.options = options;
        this.LOG = options.logger;
        this.url = (0, _gitUrlParse2.default)(remote);
        let ghopt = {
            userAgent: `${_package2.default.name}/${_package2.default.version}`
        };
        if (this.url.resource !== "github.com") {
            // for GHE
            ghopt.baseUrl = `https://${this.url.resource}/api/v3`;
        }
        this.original = new _rest2.default(ghopt);
        this.original.authenticate({
            type: "token", token: options.token
        });
    }

    pullRequest(baseBranch, newBranch, diff) {
        this.LOG(`prepare PullRequest ${this.url.toString("https")} ${baseBranch}...${newBranch}`);
        if (this.options.execute) {
            this.LOG("Create Markdown Report for PullRequest.");
            return toCompareModels(this.LOG, this.original, this.options.workingdir, diff).then(_compare.toMarkdown).then(view => {
                return {
                    owner: this.url.owner,
                    repo: this.url.name,
                    base: baseBranch,
                    head: newBranch,
                    title: `update dependencies at ${this.options.now}`,
                    body: view
                };
            }).then(value => {
                this.LOG("BEGIN Send PullRequest.");
                return this.original.pulls.create(value).then(body => {
                    this.LOG(`END   Send PullRequest. ${body.data.html_url}`);
                });
            });
        } else {
            this.LOG("Sending PullRequest is skipped because --execute is not specified.");
            return toCompareModels(this.LOG, this.original, this.options.workingdir, diff).then(_compare.toTextTable);
        }
    }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9naXRodWIuanMiXSwibmFtZXMiOlsidG9UYWciLCJ0YWdzIiwidmVyc2lvbiIsInYiLCJoYXMiLCJkaWZmVVJMIiwiY20iLCJ0byIsInJlcG8iLCJjdXJyZW50IiwidGFnIiwiZnQiLCJ0dCIsInZlcnNpb25SYW5nZSIsIkNvbXBhcmVNb2RlbCIsImNvbnN0cnVjdG9yIiwiYSIsIm5hbWUiLCJ3YW50ZWQiLCJsYXRlc3QiLCJwYWNrYWdlVHlwZSIsImhvbWVwYWdlIiwiU2V0IiwicmFuZ2VXYW50ZWQiLCJyYW5nZUxhdGVzdCIsImRpZmZXYW50ZWRVUkwiLCJkaWZmTGF0ZXN0VVJMIiwic2VsZWN0R2V0VGFnc1Byb21pc2UiLCJMT0ciLCJnaXRodWIiLCJjIiwidXJsIiwib3duZXIiLCJ0b1N0cmluZyIsInJlcXVlc3QiLCJuYW1lc3BhY2UiLCJwYWdpbmF0ZSIsInJlc3BvbnNlIiwiZGF0YSIsIm1hcCIsInQiLCJyZWYiLCJzcGxpdCIsInRoZW4iLCJlcnIiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlY29uY2lsZSIsImRlcCIsInJlcG9zaXRvcnkiLCJ1IiwicmVwbGFjZSIsIl8iLCJpc1N0cmluZyIsInNoYWRvdyIsInRvQ29tcGFyZU1vZGVscyIsImN3ZCIsImRpZmYiLCJNYXAiLCJkIiwibiIsImsiLCJnZXQiLCJwcyIsImNoaWxkcmVuIiwiZSIsInBhY2thZ2UiLCJhbGwiLCJfX3Rlc3RfXyIsIm9wdGlvbnMiLCJyZW1vdGUiLCJsb2dnZXIiLCJnaG9wdCIsInVzZXJBZ2VudCIsInBrZyIsInJlc291cmNlIiwiYmFzZVVybCIsIm9yaWdpbmFsIiwiR2l0SHViIiwiYXV0aGVudGljYXRlIiwidHlwZSIsInRva2VuIiwicHVsbFJlcXVlc3QiLCJiYXNlQnJhbmNoIiwibmV3QnJhbmNoIiwiZXhlY3V0ZSIsIndvcmtpbmdkaXIiLCJ0b01hcmtkb3duIiwidmlldyIsImJhc2UiLCJoZWFkIiwidGl0bGUiLCJub3ciLCJib2R5IiwidmFsdWUi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QU87QUFDSHhELDJCQUFPLEtBQUtELEdBQUwsQ0FBU0MsS0FEYjtBQUVIeEIsMEJBQU0sS0FBS3VCLEdBQUwsQ0FBU2QsSUFGWjtBQUdId0UsMEJBQU1OLFVBSEg7QUFJSE8sMEJBQU1OLFNBSkg7QUFLSE8sMkJBQVEsMEJBQXlCLEtBQUt0QixPQUFMLENBQWF1QixHQUFJLEVBTC9DO0FBTUhDLDBCQUFNTDtBQU5ILGlCQUFQO0FBUUgsYUFYRSxFQVdBN0MsSUFYQSxDQVdLbUQsU0FBUztBQUNiLHFCQUFLbEUsR0FBTCxDQUFTLHlCQUFUO0FBQ0EsdUJBQU8sS0FBS2lELFFBQUwsQ0FBY2tCLEtBQWQsQ0FBb0JDLE1BQXBCLENBQTJCRixLQUEzQixFQUFrQ25ELElBQWxDLENBQXVDa0QsUUFBUTtBQUNsRCx5QkFBS2pFLEdBQUwsQ0FBVSwyQkFBMEJpRSxLQUFLdkQsSUFBTCxDQUFVMkQsUUFBUyxFQUF2RDtBQUNILGlCQUZNLENBQVA7QUFHSCxhQWhCRSxDQUFQO0FBaUJILFNBbkJELE1BbUJPO0FBQ0gsaUJBQUtyRSxHQUFMLENBQVMsb0VBQVQ7QUFDQSxtQkFBTzJCLGdCQUFnQixLQUFLM0IsR0FBckIsRUFBMEIsS0FBS2lELFFBQS9CLEVBQXlDLEtBQUtSLE9BQUwsQ0FBYWlCLFVBQXRELEVBQWtFN0IsSUFBbEUsRUFDRmQsSUFERSxDQUNHdUQsb0JBREgsQ0FBUDtBQUVIO0FBQ0o7QUE1Q2dCLEMiLCJmaWxlIjoiZ2l0aHViLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGdpdHVybCBmcm9tIFwiZ2l0LXVybC1wYXJzZVwiO1xuaW1wb3J0IF8gZnJvbSBcImxvZGFzaFwiO1xuXG5pbXBvcnQgR2l0SHViIGZyb20gXCJAb2N0b2tpdC9yZXN0XCI7XG5cbmltcG9ydCBwa2cgZnJvbSBcIi4uL3BhY2thZ2UuanNvblwiO1xuaW1wb3J0IHsgdG9NYXJrZG93biwgdG9UZXh0VGFibGUgfSBmcm9tIFwiLi9jb21wYXJlXCI7XG5pbXBvcnQgcnB0IGZyb20gXCIuL3Byb21pc2UvcmVhZC1wYWNrYWdlLXRyZWVcIjtcblxuZnVuY3Rpb24gdG9UYWcodGFncywgdmVyc2lvbikge1xuICAgIGxldCB2ID0gYHYke3ZlcnNpb259YDtcbiAgICBpZiAodGFncy5oYXModikpIHtcbiAgICAgICAgcmV0dXJuIHY7XG4gICAgfVxuICAgIHJldHVybiB0YWdzLmhhcyh2ZXJzaW9uKSAmJiB2ZXJzaW9uO1xufVxuXG5mdW5jdGlvbiBkaWZmVVJMKGNtLCB0bykge1xuICAgIGlmIChjbS5yZXBvKSB7XG4gICAgICAgIGlmIChjbS5jdXJyZW50ID09PSB0bykge1xuICAgICAgICAgICAgbGV0IHRhZyA9IHRvVGFnKGNtLnRhZ3MsIGNtLmN1cnJlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIHRhZyAmJiBgJHtjbS5yZXBvfS90cmVlLyR7dGFnfWA7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGZ0ID0gdG9UYWcoY20udGFncywgY20uY3VycmVudCk7XG4gICAgICAgIGxldCB0dCA9IHRvVGFnKGNtLnRhZ3MsIHRvKTtcbiAgICAgICAgcmV0dXJuIGZ0ICYmIHR0ICYmIGAke2NtLnJlcG99L2NvbXBhcmUvJHtmdH0uLi4ke3R0fWA7XG4gICAgfVxuICAgIHJldHVybiBcIlwiO1xufVxuXG5mdW5jdGlvbiB2ZXJzaW9uUmFuZ2UoY3VycmVudCwgdG8pIHtcbiAgICBpZiAoY3VycmVudCA9PT0gdG8pIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBgJHtjdXJyZW50fS4uLiR7dG99YDtcbn1cblxuY2xhc3MgQ29tcGFyZU1vZGVsIHtcbiAgICBjb25zdHJ1Y3RvcihhKSB7XG4gICAgICAgIFt0aGlzLm5hbWUsIHRoaXMuY3VycmVudCwgdGhpcy53YW50ZWQsIHRoaXMubGF0ZXN0LCB0aGlzLnBhY2thZ2VUeXBlXSA9IGE7XG4gICAgICAgIHRoaXMucmVwbyA9IFwiXCI7XG4gICAgICAgIHRoaXMuaG9tZXBhZ2UgPSBcIlwiO1xuICAgICAgICB0aGlzLnRhZ3MgPSBuZXcgU2V0KCk7XG4gICAgfVxuXG4gICAgcmFuZ2VXYW50ZWQoKSB7XG4gICAgICAgIHJldHVybiB2ZXJzaW9uUmFuZ2UodGhpcy5jdXJyZW50LCB0aGlzLndhbnRlZCk7XG4gICAgfVxuXG4gICAgcmFuZ2VMYXRlc3QoKSB7XG4gICAgICAgIHJldHVybiB2ZXJzaW9uUmFuZ2UodGhpcy5jdXJyZW50LCB0aGlzLmxhdGVzdCk7XG4gICAgfVxuXG4gICAgZGlmZldhbnRlZFVSTCgpIHtcbiAgICAgICAgcmV0dXJuIGRpZmZVUkwodGhpcywgdGhpcy53YW50ZWQpO1xuICAgIH1cblxuICAgIGRpZmZMYXRlc3RVUkwoKSB7XG4gICAgICAgIHJldHVybiBkaWZmVVJMKHRoaXMsIHRoaXMubGF0ZXN0KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNlbGVjdEdldFRhZ3NQcm9taXNlKExPRywgZ2l0aHViLCBjKSB7XG4gICAgaWYgKGMucmVwbykge1xuICAgICAgICBsZXQgdXJsID0gZ2l0dXJsKGMucmVwbyk7XG4gICAgICAgIGlmICh1cmwub3duZXIgJiYgdXJsLm5hbWUpIHtcbiAgICAgICAgICAgIExPRyhgQkVHSU4gZ2V0VGFncyBmcm9tICR7dXJsLnRvU3RyaW5nKFwiaHR0cHNcIil9YCk7XG4gICAgICAgICAgICBsZXQgcmVxdWVzdCA9IHsgb3duZXI6IHVybC5vd25lciwgcmVwbzogdXJsLm5hbWUsIG5hbWVzcGFjZTogXCJ0YWdzL1wiIH07XG4gICAgICAgICAgICByZXR1cm4gZ2l0aHViLnBhZ2luYXRlKFwiR0VUIC9yZXBvcy86b3duZXIvOnJlcG8vZ2l0L3JlZnMvOm5hbWVzcGFjZVwiLFxuICAgICAgICAgICAgICAgIHJlcXVlc3QsIHJlc3BvbnNlID0+IHJlc3BvbnNlLmRhdGEubWFwKHQgPT4gdC5yZWYuc3BsaXQoXCIvXCIpWzJdKSlcbiAgICAgICAgICAgICAgICAudGhlbih0YWdzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgTE9HKGBFTkQgICBnZXRUYWdzICR7dGFnc31gKTtcbiAgICAgICAgICAgICAgICAgICAgYy50YWdzID0gbmV3IFNldCh0YWdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGM7XG4gICAgICAgICAgICAgICAgfSwgZXJyID0+IHtcbiAgICAgICAgICAgICAgICAgICAgTE9HKGBFTkQgICBnZXRUYWdzICR7cmVxdWVzdH0gJHtlcnJ9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoYyk7XG59XG5cbmZ1bmN0aW9uIHJlY29uY2lsZShMT0csIGdpdGh1YiwgZGVwLCBjKSB7XG4gICAgTE9HKGBCRUdJTiByZWNvbmNpbGUgQ29tcGFyZU1vZGVsICR7Yy5uYW1lfWApO1xuICAgIGMuaG9tZXBhZ2UgPSBkZXAuaG9tZXBhZ2U7XG4gICAgaWYgKGRlcC5yZXBvc2l0b3J5KSB7XG4gICAgICAgIGlmIChkZXAucmVwb3NpdG9yeS51cmwpIHtcbiAgICAgICAgICAgIGxldCB1ID0gZ2l0dXJsKGRlcC5yZXBvc2l0b3J5LnVybCk7XG4gICAgICAgICAgICBjLnJlcG8gPSB1ICYmIHUudG9TdHJpbmcoXCJodHRwc1wiKS5yZXBsYWNlKC9cXC5naXQkLywgXCJcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKF8uaXNTdHJpbmcoZGVwLnJlcG9zaXRvcnkpICYmIDIgPT09IGRlcC5zcGxpdChcIi9cIikpIHtcbiAgICAgICAgICAgIGMucmVwbyA9IGBodHRwczovL2dpdGh1Yi5jb20vJHtkZXAucmVwb3NpdG9yeX1gO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjLnNoYWRvdyA/IFByb21pc2UucmVzb2x2ZShjKSA6IHNlbGVjdEdldFRhZ3NQcm9taXNlKExPRywgZ2l0aHViLCBjKS50aGVuKGMgPT4ge1xuICAgICAgICBMT0coYEVORCAgIHJlY29uY2lsZSBDb21wYXJlTW9kZWwgJHtjLm5hbWV9YCk7XG4gICAgICAgIHJldHVybiBjO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiB0b0NvbXBhcmVNb2RlbHMoTE9HLCBnaXRodWIsIGN3ZCwgZGlmZikge1xuICAgIGxldCBtYXAgPSBuZXcgTWFwKGRpZmYubWFwKGQgPT4ge1xuICAgICAgICBsZXQgYyA9IG5ldyBDb21wYXJlTW9kZWwoZCk7XG4gICAgICAgIHJldHVybiBbYy5uYW1lLCBjXTtcbiAgICB9KSk7XG4gICAgTE9HKFwiQkVHSU4gcmVhZC1wYWNrYWdlLXRyZWVcIik7XG4gICAgcmV0dXJuIHJwdChjd2QsIChuLCBrKSA9PiBtYXAuZ2V0KGspKS50aGVuKGRhdGEgPT4ge1xuICAgICAgICBMT0coXCJFTkQgICByZWFkLXBhY2thZ2UtdHJlZVwiKTtcbiAgICAgICAgbGV0IHBzID0gZGF0YS5jaGlsZHJlbi5tYXAoZSA9PiByZWNvbmNpbGUoTE9HLCBnaXRodWIsIGUucGFja2FnZSwgbWFwLmdldChlLnBhY2thZ2UubmFtZSkpKTtcbiAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHBzKS50aGVuKCgpID0+IG1hcCk7XG4gICAgfSk7XG59XG5cbi8vIGZvciB0ZXNpbmcgcHVycG9zZVxuZXhwb3J0IGNvbnN0IF9fdGVzdF9fID0gW0NvbXBhcmVNb2RlbCwgZGlmZlVSTCwgdG9UYWcsIHZlcnNpb25SYW5nZV07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zLCByZW1vdGUpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5MT0cgPSBvcHRpb25zLmxvZ2dlcjtcbiAgICAgICAgdGhpcy51cmwgPSBnaXR1cmwocmVtb3RlKTtcbiAgICAgICAgbGV0IGdob3B0ID0ge1xuICAgICAgICAgICAgdXNlckFnZW50OiBgJHtwa2cubmFtZX0vJHtwa2cudmVyc2lvbn1gXG4gICAgICAgIH07XG4gICAgICAgIGlmICh0aGlzLnVybC5yZXNvdXJjZSAhPT0gXCJnaXRodWIuY29tXCIpIHtcbiAgICAgICAgICAgIC8vIGZvciBHSEVcbiAgICAgICAgICAgIGdob3B0LmJhc2VVcmwgPSBgaHR0cHM6Ly8ke3RoaXMudXJsLnJlc291cmNlfS9hcGkvdjNgO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub3JpZ2luYWwgPSBuZXcgR2l0SHViKGdob3B0KTtcbiAgICAgICAgdGhpcy5vcmlnaW5hbC5hdXRoZW50aWNhdGUoe1xuICAgICAgICAgICAgdHlwZTogXCJ0b2tlblwiLCB0b2tlbjogb3B0aW9ucy50b2tlblxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWxsUmVxdWVzdChiYXNlQnJhbmNoLCBuZXdCcmFuY2gsIGRpZmYpIHtcbiAgICAgICAgdGhpcy5MT0coYHByZXBhcmUgUHVsbFJlcXVlc3QgJHt0aGlzLnVybC50b1N0cmluZyhcImh0dHBzXCIpfSAke2Jhc2VCcmFuY2h9Li4uJHtuZXdCcmFuY2h9YCk7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZXhlY3V0ZSkge1xuICAgICAgICAgICAgdGhpcy5MT0coXCJDcmVhdGUgTWFya2Rvd24gUmVwb3J0IGZvciBQdWxsUmVxdWVzdC5cIik7XG4gICAgICAgICAgICByZXR1cm4gdG9Db21wYXJlTW9kZWxzKHRoaXMuTE9HLCB0aGlzLm9yaWdpbmFsLCB0aGlzLm9wdGlvbnMud29ya2luZ2RpciwgZGlmZilcbiAgICAgICAgICAgICAgICAudGhlbih0b01hcmtkb3duKVxuICAgICAgICAgICAgICAgIC50aGVuKHZpZXcgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3duZXI6IHRoaXMudXJsLm93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVwbzogdGhpcy51cmwubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhc2U6IGJhc2VCcmFuY2gsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkOiBuZXdCcmFuY2gsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogYHVwZGF0ZSBkZXBlbmRlbmNpZXMgYXQgJHt0aGlzLm9wdGlvbnMubm93fWAsXG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5OiB2aWV3XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSkudGhlbih2YWx1ZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuTE9HKFwiQkVHSU4gU2VuZCBQdWxsUmVxdWVzdC5cIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm9yaWdpbmFsLnB1bGxzLmNyZWF0ZSh2YWx1ZSkudGhlbihib2R5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuTE9HKGBFTkQgICBTZW5kIFB1bGxSZXF1ZXN0LiAke2JvZHkuZGF0YS5odG1sX3VybH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLkxPRyhcIlNlbmRpbmcgUHVsbFJlcXVlc3QgaXMgc2tpcHBlZCBiZWNhdXNlIC0tZXhlY3V0ZSBpcyBub3Qgc3BlY2lmaWVkLlwiKTtcbiAgICAgICAgICAgIHJldHVybiB0b0NvbXBhcmVNb2RlbHModGhpcy5MT0csIHRoaXMub3JpZ2luYWwsIHRoaXMub3B0aW9ucy53b3JraW5nZGlyLCBkaWZmKVxuICAgICAgICAgICAgICAgIC50aGVuKHRvVGV4dFRhYmxlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==