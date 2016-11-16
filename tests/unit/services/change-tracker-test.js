import { moduleFor, test } from 'ember-qunit';
import ChangeTracker from "ember-change-tracker/services/change-tracker";
import Ember from "ember";

moduleFor('service:change-tracker', 'Unit | Service | change tracker', {
  subject() {
    return ChangeTracker.extend({
      detectProperties() { return []; },
      reincarnateRecord() {},
      deleteRecord() {}
    }).create();
  }
});

test('it stores record snapshot', function(assert) {
  let service = this.subject();
  let record1 = Ember.Object.create({
    firstName: "John",
    lastName: "Smith",
    age: 73
  });
  let record2 = Ember.Object.create({
    firstName: "Amanda",
    lastName: "Jackson",
    age: 22
  });
  let didCallDetect = false;
  service.detectProperties = function(record) {
    didCallDetect = record === record2;
    return [];
  };

  service.begin(record1, "firstName", "age");

  record1.set("firstName", "Ronald");

  assert.deepEqual(
    service.get("snapshots").get(record1),
    {firstName: "John", age: 73},
    "should snapshot only firstName and age"
  );

  service.begin(record1, "lastName");

  assert.deepEqual(
    service.get("snapshots").get(record1),
    {firstName: "John", age: 73, lastName: "Smith"},
    "should extend existing snapshot"
  );

  service.begin(record2);
  assert.deepEqual(didCallDetect, true, "should detect record properties");
});

test('it stores record action', function(assert) {
  let service = this.subject();
  let record = Ember.Object.create();

  service.begin(record);
  assert.equal(service.get("actions").get(record), "change");

  service.didCreate(record);
  assert.equal(service.get("actions").get(record), "create");

  service.didDelete(record);
  assert.equal(service.get("actions").get(record), "delete");
});

test('it detects record changes', function(assert) {
  let service = this.subject();
  let record1 = Ember.Object.create({ firstName: "Ann" });
  let record2 = Ember.Object.create({ firstName: "Jack" });
  let record3 = Ember.Object.create({ firstName: "Lucy" });

  service.begin(record1, "firstName");
  assert.equal(service.detectChanges(record1), false, "unchanged record should be considered clean");

  record1.set("firstName", "Mary");
  assert.equal(service.detectChanges(record1), true, "changed record should be considered dirty");

  service.didCreate(record2, "firstName");
  assert.equal(service.detectChanges(record2), true, "created record should always be considered dirty");

  service.didDelete(record3, "firstName");
  assert.equal(service.detectChanges(record3), true, "deleted record should always be considered dirty");
});

test('it commits changes', function(assert) {
  let service = this.subject();
  let record = Ember.Object.create({ firstName: "Ann" });

  service.begin(record, "firstName");
  assert.equal(service.get("undoStack.length"), 0, "before commit undo stack should be empty");

  service.commit(record);
  assert.equal(service.get("undoStack.length"), 0, "if no changes were made undo stack should be empty");

  service.begin(record, "firstName");
  record.set("firstName", "Mary");
  service.commit(record);
  assert.equal(service.get("undoStack.length"), 1, "undo stack should contain the record");

});

test('it rollbacks changes', function(assert) {
  let service = this.subject();
  let record = Ember.Object.create({ firstName: "Ann" });
  let lastCalledMethod = null;
  service.deleteRecord = function() {
    lastCalledMethod = "delete";
  };
  service.reincarnateRecord = function(record) {
    lastCalledMethod = "reincarnate";
    return record;
  };

  service.begin(record, "firstName");
  record.set("firstName", "Mary");
  service.rollback(record);
  assert.equal(record.get("firstName"), "Ann", "should set properties to its original values");
  assert.equal(service.get("undoStack.length"), 0, "undo stack should be empty");

  service.didCreate(record, "firstName");
  service.rollback(record);
  assert.equal(lastCalledMethod, "delete", "should delete record");

  service.didDelete(record, "firstName");
  service.rollback(record);
  assert.equal(lastCalledMethod, "reincarnate", "should reincarnate record");
});

test('it udoes & redoes changes', function(assert) {
  let service = this.subject();
  let record = Ember.Object.create({ firstName: "Ann" });
  let lastCalledMethod = null;
  service.deleteRecord = function() {
    lastCalledMethod = "delete";
  };
  service.reincarnateRecord = function(record) {
    lastCalledMethod = "reincarnate";
    return record;
  };

  service.begin(record, "firstName");
  record.set("firstName", "Mary");
  service.commit(record);

  service.undo();
  assert.equal(service.get("undoStack.length"), 0, "undo stack should be empty");
  assert.equal(service.get("redoStack.length"), 1, "redo stack should contain one record");
  assert.equal(record.get("firstName"), "Ann", "should set properties to its original values");

  service.redo();
  assert.equal(service.get("undoStack.length"), 1, "undo stack should contain one record");
  assert.equal(service.get("redoStack.length"), 0, "redo stack should be empty");
  assert.equal(record.get("firstName"), "Mary", "should set properties to its new values");

  service.didCreate(record, "firstName");
  service.commit(record);
  service.undo();
  assert.equal(lastCalledMethod, "delete", "after undo record should be deleted");
  service.redo();
  assert.equal(lastCalledMethod, "reincarnate", "after redo record should be reincarnated");

  service.didDelete(record, "firstName");
  service.commit(record);
  service.undo();
  assert.equal(lastCalledMethod, "reincarnate", "after undo record should be reincarnated");
  service.redo();
  assert.equal(lastCalledMethod, "delete", "after redo record should be deleted");
});

test('it reincarnates records', function(assert) {
  let service = this.subject();
  let record1, record2, reincarnation;

  Ember.run(function() {
    function mockAssociation(content) {
      return Ember.ObjectProxy.extend(Ember.PromiseProxyMixin).create({
        promise: Ember.RSVP.resolve(content)
      });
    }
    record1 = Ember.Object.create({ id: 1, firstName: "Ann", lastName: undefined });
    record2 = Ember.Object.create({
      id: 2,
      param1: 0,
      param2: 120,
      syncPresent: record1,
      syncMissing: undefined,
      asyncPresent: mockAssociation(record1),
      asyncMissing: mockAssociation(undefined)
    });
    reincarnation = Ember.Object.create({ id: 3 });
  });

  service.reincarnateRecord = function() {
    return reincarnation;
  };
  service.detectProperties = function(record) {
    return Object.keys(record);
  };

  service.didCreate(record1);
  service.didCreate(record2);
  service.commit(record1, record2);

  service.didDelete(record1);
  service.commit(record1);

  service.undo();

  assert.equal(service.get("undoStack")[0][0][0], reincarnation, "should replace snapshot record reference with its reincarnation");
  assert.propEqual(service.get("undoStack")[0][1][2], {
    id: 2,
    param1: 0,
    param2: 120,
    syncPresent: reincarnation,
    syncMissing: undefined,
    asyncPresent: reincarnation,
    asyncMissing: null
  }, "should replace old record references with its reincarnation");
  assert.propEqual(service.get("undoStack")[0][1][3], {
    id: 2,
    param1: 0,
    param2: 120,
    syncPresent: reincarnation,
    syncMissing: undefined,
    asyncPresent: reincarnation,
    asyncMissing: null
  }, "should replace new record references with its reincarnation");
});

test('it changes state', function(assert) {
  let service = this.subject();
  let record = Ember.Object.create({ firstName: "Ann" });

  service.begin(record, "firstName");
  assert.equal(service.get("hasUncommitedRecords"), true, "should declare uncommited records");
  assert.equal(service.get("undoAvailable"), false, "undo should not be available");
  assert.equal(service.get("redoAvailable"), false, "redo should not be available");

  record.set("firstName", "Jack");
  service.commit(record);
  assert.equal(service.get("hasUncommitedRecords"), false, "should not declare uncommited records");
  assert.equal(service.get("undoAvailable"), true, "after commit undo should be available");
  assert.equal(service.get("redoAvailable"), false, "after commit redo should not be available");

  service.undo();
  assert.equal(service.get("undoAvailable"), false, "after undo undo should not be available");
  assert.equal(service.get("redoAvailable"), true, "after undo redo should be available");
});

test('it triggers events', function(assert) {
  let service = this.subject();
  let changedArgs, undoneArgs, redoneArgs;
  service.on("change", function(...args) { changedArgs = args; });
  service.on("undo", function(...args) { undoneArgs = args; });
  service.on("redo", function(...args) { redoneArgs = args; });

  let record1 = Ember.Object.create({ firstName: "Ann" });
  let record2 = Ember.Object.create({ firstName: "Mickey" });

  service.begin(record1, "firstName");
  service.begin(record2, "firstName");
  record1.set("firstName", "Alice");
  record2.set("firstName", "Ron");
  service.commit(record1, record2);

  assert.deepEqual(changedArgs, ["commit", [record1, record2]], "after commit should trigger change event");
  assert.equal(undoneArgs, undefined, "after change should not trigger undo event");
  assert.equal(redoneArgs, undefined, "after change should not trigger redo event");
  changedArgs = undefined;

  service.undo();
  assert.deepEqual(changedArgs, ["undo", [record1, record2]], "after undo should trigger change event");
  assert.deepEqual(undoneArgs, [[record1, record2]], "after undo should trigger undo event");
  assert.equal(redoneArgs, undefined, "after undo should not trigger redo event");
  changedArgs = undoneArgs = undefined;

  service.redo();
  assert.deepEqual(changedArgs, ["redo", [record1, record2]], "after redo should trigger change event");
  assert.equal(undoneArgs, undefined, "after redo should not trigger undo event");
  assert.deepEqual(redoneArgs, [[record1, record2]], "after redo should  trigger redo event");
});
