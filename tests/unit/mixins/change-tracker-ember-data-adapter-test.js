import Ember from 'ember';
import ChangeTrackerEmberDataAdapterMixin from 'ember-change-tracker/mixins/change-tracker-ember-data-adapter';
import { module, test } from 'qunit';

module('Unit | Mixin | change tracker ember data adapter');

// Replace this with your real tests.
test('it works', function(assert) {
  let ChangeTrackerEmberDataAdapterObject = Ember.Object.extend(ChangeTrackerEmberDataAdapterMixin);
  let subject = ChangeTrackerEmberDataAdapterObject.create();
  assert.ok(subject);
});
